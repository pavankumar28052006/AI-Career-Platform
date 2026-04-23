"""Tests for skill_extractor — assert 6 skills extracted from sample resume."""

import pytest
from unittest.mock import AsyncMock, patch


# Sample resume that contains exactly 6 skills from _KNOWN_SKILLS vocabulary:
# Python, SQL, Machine Learning, Data Analysis, TensorFlow, Docker
SAMPLE_RESUME = """
John Doe — Data Scientist
Experience:
- Built ML pipelines using Python and TensorFlow for image classification
- Performed Data Analysis on customer churn datasets using SQL queries
- Containerised services with Docker for reproducible training environments
- Designed Machine Learning models for revenue forecasting
Skills: Python, SQL, TensorFlow, Docker, Machine Learning, Data Analysis
Education: B.Sc. Computer Science
"""

EXPECTED_SKILLS = {"Python", "SQL", "Machine Learning", "Data Analysis", "TensorFlow", "Docker"}


@pytest.mark.asyncio
async def test_spacy_extracts_six_skills(fake_redis):
    """SpaCy PhraseMatcher should find at least 6 skills without hitting GPT."""
    with patch("db.redis_client._redis", fake_redis):
        # Fresh cache — no prior entries
        from services.skill_extractor import extract_skills

        with patch("services.skill_extractor._extract_with_gpt", new_callable=AsyncMock) as mock_gpt:
            skills = await extract_skills(SAMPLE_RESUME)

        # GPT must NOT have been called (SpaCy should cover all 6)
        mock_gpt.assert_not_called()

        skill_set = set(skills)
        assert EXPECTED_SKILLS.issubset(skill_set), (
            f"Expected {EXPECTED_SKILLS} ⊆ {skill_set}"
        )


@pytest.mark.asyncio
async def test_extracted_skills_cached_after_first_call(fake_redis):
    """Second call with the same text should be a cache hit."""
    with patch("db.redis_client._redis", fake_redis):
        from services.skill_extractor import extract_skills

        first = await extract_skills(SAMPLE_RESUME)
        second = await extract_skills(SAMPLE_RESUME)

        assert set(first) == set(second)


@pytest.mark.asyncio
async def test_gpt_fallback_called_when_spacy_finds_nothing(fake_redis):
    """GPT fallback triggers when SpaCy finds no skills."""
    with patch("db.redis_client._redis", fake_redis):
        from services.skill_extractor import extract_skills

        gpt_result = ["QuantumComputing", "NeuralInterface"]
        with patch(
            "services.skill_extractor._extract_with_gpt",
            new_callable=AsyncMock,
            return_value=gpt_result,
        ) as mock_gpt:
            result = await extract_skills("This resume has no recognizable skills at all.")
            mock_gpt.assert_called_once()
            assert result == gpt_result
