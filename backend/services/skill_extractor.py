"""Skill extraction service.

SpaCy model is loaded **once at module level** — never inside a request handler.
Cache strategy: Redis → SpaCy + rules → GPT fallback.
Cache key: ``skills:{sha256(text)}``, TTL = 24 h.
"""

import hashlib
import json
import re
from typing import Optional

import spacy
from spacy.matcher import PhraseMatcher
from tenacity import retry, stop_after_attempt, wait_exponential

from core.config import get_settings
from core.logging import get_logger
from db.redis_client import cache_get, cache_set, get_redis

logger = get_logger(__name__)

# ── SpaCy loaded once at module import time ──────────────────────────────────
_nlp = None  # type: ignore[assignment]
for model_name in ("en_core_web_md", "en_core_web_sm"):
    try:
        _nlp = spacy.load(model_name)
        logger.info("Loaded SpaCy model", extra={"model": model_name})
        break
    except OSError:
        continue

if _nlp is None:
    logger.warning(
        "No supported SpaCy model found; install en_core_web_md or en_core_web_sm"
    )

# Known skill vocabulary for PhraseMatcher (extend as needed)
_KNOWN_SKILLS: list[str] = [
    "Python", "SQL", "Machine Learning", "Deep Learning", "Data Analysis",
    "TensorFlow", "PyTorch", "Spark", "Kafka", "Docker", "Kubernetes",
    "REST APIs", "FastAPI", "React", "TypeScript", "Neo4j", "Redis",
    "AWS", "GCP", "Azure", "Statistics", "NLP", "Computer Vision",
    "Pandas", "NumPy", "Scikit-learn", "Git", "Linux", "Java", "Scala",
    "C++", "Go", "Rust", "GraphQL", "PostgreSQL", "MongoDB",
]

_matcher: Optional[PhraseMatcher] = None

if _nlp is not None:
    _matcher = PhraseMatcher(_nlp.vocab, attr="LOWER")
    patterns = [_nlp.make_doc(skill) for skill in _KNOWN_SKILLS]
    _matcher.add("SKILLS", patterns)

_CACHE_TTL = 86_400  # 24 hours


def _text_cache_key(text: str) -> str:
    return "skills:" + hashlib.sha256(text.encode()).hexdigest()


def _extract_with_spacy(text: str) -> list[str]:
    """Extract skills using PhraseMatcher over the known vocabulary."""
    if _nlp is None or _matcher is None:
        return []
    doc = _nlp(text)
    seen: set[str] = set()
    found: list[str] = []
    for _, start, end in _matcher(doc):
        skill = doc[start:end].text
        if skill not in seen:
            seen.add(skill)
            found.append(skill)
    return found


def _extract_with_rules(text: str) -> list[str]:
    """Extract known skills via case-insensitive boundary matching.

    This keeps extraction deterministic even when no SpaCy model is available.
    """
    lowered_text = text.lower()
    found: list[str] = []
    for skill in _KNOWN_SKILLS:
        pattern = rf"(?<!\w){re.escape(skill.lower())}(?!\w)"
        if re.search(pattern, lowered_text):
            found.append(skill)
    return found


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def _extract_with_gpt_raw(text: str) -> list[str]:
    import openai  # local import to allow mocking in tests
    settings = get_settings()
    client = openai.AsyncOpenAI(api_key=settings.openai_api_key)
    text_snippet = text[:3000]
    prompt = (
        "Extract a list of technical skills from the following resume text. "
        "Return only a JSON array of skill name strings, nothing else.\n\n"
        f"{text_snippet}"
    )
    response = await client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=300,
        timeout=10.0,
    )
    raw = response.choices[0].message.content or "[]"
    try:
        skills = json.loads(raw)
        return [s for s in skills if isinstance(s, str)]
    except json.JSONDecodeError:
        logger.warning("GPT returned non-JSON skill list", extra={"raw": raw[:200]})
        return []

async def _extract_with_gpt(text: str) -> list[str]:
    """GPT fallback wrapped with metrics and graceful degradation."""
    redis = get_redis()
    await redis.incr("metrics:total_gpt_calls")
    try:
        return await _extract_with_gpt_raw(text)
    except Exception as exc:  # Swallow the RetryError and fallback to Spacy-only empty return
        logger.error("GPT extraction completely failed after retries", extra={"error": str(exc)})
        return []


async def extract_skills(text: str) -> list[str]:
    """Return skills extracted from *text*.

    Order of precedence:
    1. Redis cache hit → return immediately (no GPT)
    2. SpaCy PhraseMatcher → cache result, return
    3. GPT fallback → cache result, return
    """
    cache_key = _text_cache_key(text)

    # 1. Cache hit
    cached = await cache_get(cache_key)
    if cached is not None:
        logger.info("Skill cache hit", extra={"key": cache_key})
        return cached  # type: ignore[return-value]

    # 2. SpaCy + deterministic rules
    skills = _extract_with_spacy(text)
    if not skills:
        skills = _extract_with_rules(text)
    if skills:
        await cache_set(cache_key, skills, ttl=_CACHE_TTL)
        logger.info("Skills extracted via SpaCy", extra={"count": len(skills)})
        return skills

    # 3. GPT fallback
    logger.info("SpaCy found no skills; falling back to GPT")
    skills = await _extract_with_gpt(text)
    await cache_set(cache_key, skills, ttl=_CACHE_TTL)
    logger.info("Skills extracted via GPT", extra={"count": len(skills)})
    return skills
