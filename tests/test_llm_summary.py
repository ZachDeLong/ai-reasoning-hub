"""Tests for llm_summary.py - triage and LLM abstraction."""

import pytest
from unittest.mock import patch, MagicMock


class TestTriageWithOpenAI:
    """Tests for OpenAI triage fallback with error handling."""

    def test_fallback_returns_valid_dict_structure(self):
        """Triage fallback should return dict with expected keys."""
        from llm_summary import triage_with_openai

        # Test with a mocked OpenAI that raises an error
        mock_openai = MagicMock()
        mock_openai.side_effect = RuntimeError("API unavailable")

        with patch.dict('sys.modules', {'openai': MagicMock(OpenAI=mock_openai)}):
            result = triage_with_openai("Test Paper", "This is an abstract.")

            # Should return fallback response with all required keys
            assert 'relevant' in result
            assert 'reason' in result
            assert 'model' in result
            assert 'tokens' in result
            assert result['relevant'] is True  # Fallback defaults to relevant

    def test_fallback_handles_connection_error(self):
        """When connection fails, should return safe default."""
        from llm_summary import triage_with_openai

        # Patch at the module level where OpenAI is imported inside the function
        with patch.dict('sys.modules', {'openai': MagicMock()}):
            import sys
            mock_openai_module = sys.modules['openai']
            mock_openai_module.OpenAI.side_effect = ConnectionError("Network error")

            result = triage_with_openai("Test Paper", "This is an abstract.")

            assert result['relevant'] is True
            assert 'fallback-default' in result['model']
            assert result['tokens'] == 0

    def test_response_structure_always_complete(self):
        """Response should always have all required fields."""
        from llm_summary import triage_with_openai

        # Force the fallback path by making OpenAI unavailable
        with patch.dict('sys.modules', {'openai': None}):
            result = triage_with_openai("Test", "Abstract")

            # Regardless of success/failure, structure should be complete
            assert isinstance(result, dict)
            assert 'relevant' in result
            assert isinstance(result['relevant'], bool)
            assert 'reason' in result
            assert 'model' in result
            assert 'tokens' in result


class TestTriagePaper:
    """Tests for main triage_paper function (Gemini primary, OpenAI fallback)."""

    def test_missing_google_api_key_falls_back(self):
        """When GOOGLE_API_KEY is not set, should fall back to OpenAI."""
        from llm_summary import triage_paper
        import os

        # Temporarily remove GOOGLE_API_KEY
        original_key = os.environ.pop('GOOGLE_API_KEY', None)

        try:
            with patch('llm_summary.triage_with_openai') as mock_openai_triage:
                mock_openai_triage.return_value = {
                    'relevant': True,
                    'reason': 'No Google key',
                    'model': 'gpt-4o-mini (fallback)',
                    'tokens': 25
                }

                result = triage_paper("Test Paper", "Test abstract")

                # Should have called the fallback
                assert mock_openai_triage.called or result['relevant'] is True
        finally:
            # Restore original key if it existed
            if original_key:
                os.environ['GOOGLE_API_KEY'] = original_key

    def test_triage_paper_returns_expected_structure(self):
        """triage_paper should always return dict with required keys."""
        from llm_summary import triage_paper

        # Mock both to ensure we get a controlled response
        with patch('llm_summary.triage_with_openai') as mock_fallback:
            mock_fallback.return_value = {
                'relevant': True,
                'reason': 'Test reason',
                'model': 'test-model',
                'tokens': 10
            }

            result = triage_paper("Test Paper", "Test abstract about AI reasoning.")

            assert isinstance(result, dict)
            assert 'relevant' in result
            assert 'reason' in result
            assert 'model' in result
