"""Unit tests for configuration."""

import os
from src.config import Settings

def test_settings_load_from_env():
    """Test that settings load correctly."""
    os.environ["DATABASE_URL"] = "postgres://test"
    os.environ["DATABASE_READONLY_URL"] = "postgres://test-readonly"
    os.environ["GROQ_API_KEY"] = "test-key"

    settings = Settings()

    assert settings.DATABASE_URL == "postgres://test"
    assert settings.DATABASE_READONLY_URL == "postgres://test-readonly"
    assert settings.GROQ_API_KEY == "test-key"
    assert settings.GROQ_MODEL_NAME == "openai/gpt-oss-120b"

    # Cleanup
    del os.environ["DATABASE_URL"]
    del os.environ["DATABASE_READONLY_URL"]
    del os.environ["GROQ_API_KEY"]
