"""Tests for Redis caching — GPT called exactly once across two identical uploads.

Critical assertions:
1. First upload triggers GPT (cache miss).
2. Identical second upload hits the cache and does NOT call GPT again.
   → openai mock call_count == 1 across both calls combined.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


SAMPLE_TEXT = (
    "This resume contains skills that SpaCy cannot detect: "
    "QuantumNetworking, BioComputing, NeuroInterface, HoloStorage"
)

GPT_EXTRACTED = ["QuantumNetworking", "BioComputing", "NeuroInterface", "HoloStorage"]


@pytest.mark.asyncio
async def test_gpt_called_exactly_once_for_two_identical_uploads(fake_redis):
    """OpenAI must be called exactly 1 time across two calls with the same text."""

    with patch("db.redis_client._redis", fake_redis):
        from services import skill_extractor as se

        mock_gpt = AsyncMock(return_value=GPT_EXTRACTED)

        with patch.object(se, "_extract_with_gpt", mock_gpt):
            # First call — cache miss → GPT called
            result1 = await se.extract_skills(SAMPLE_TEXT)

            # Second call with identical text — cache hit → GPT NOT called again
            result2 = await se.extract_skills(SAMPLE_TEXT)

        # GPT must have been called exactly once total
        assert mock_gpt.call_count == 1, (
            f"Expected GPT called exactly 1 time, but was called {mock_gpt.call_count} times"
        )

        # Both results must be identical
        assert result1 == result2 == GPT_EXTRACTED


@pytest.mark.asyncio
async def test_different_texts_each_trigger_gpt(fake_redis):
    """Two different texts should each trigger one GPT call (2 total)."""
    with patch("db.redis_client._redis", fake_redis):
        from services import skill_extractor as se

        mock_gpt = AsyncMock(return_value=GPT_EXTRACTED)

        with patch.object(se, "_extract_with_gpt", mock_gpt):
            await se.extract_skills(SAMPLE_TEXT + " version 1")
            await se.extract_skills(SAMPLE_TEXT + " version 2")

        assert mock_gpt.call_count == 2, (
            f"Expected 2 GPT calls for 2 different texts, got {mock_gpt.call_count}"
        )


@pytest.mark.asyncio
async def test_cache_survives_across_independent_extract_calls(fake_redis):
    """Cache hit is confirmed by checking Redis has the key after first call."""
    import hashlib

    with patch("db.redis_client._redis", fake_redis):
        from services import skill_extractor as se

        mock_gpt = AsyncMock(return_value=GPT_EXTRACTED)

        with patch.object(se, "_extract_with_gpt", mock_gpt):
            await se.extract_skills(SAMPLE_TEXT)

        # Verify the key is in the fake Redis store
        cache_key = "skills:" + hashlib.sha256(SAMPLE_TEXT.encode()).hexdigest()
        cached_value = await fake_redis.get(cache_key)
        assert cached_value is not None, "Cache key not found after first extraction"
