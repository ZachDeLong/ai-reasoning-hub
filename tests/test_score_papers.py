"""Tests for score_papers.py - JSON parsing and score validation."""

import pytest
from score_papers import extract_first_json_object, parse_score_response


class TestExtractFirstJsonObject:
    """Tests for bracket-balanced JSON extraction."""

    def test_simple_json(self):
        """Extract simple JSON object."""
        text = '{"a": 1, "b": 2}'
        result = extract_first_json_object(text)
        assert result == '{"a": 1, "b": 2}'

    def test_json_with_preamble(self):
        """Extract JSON after LLM commentary."""
        text = 'Here is the result: {"score": 5}'
        result = extract_first_json_object(text)
        assert result == '{"score": 5}'

    def test_multiple_json_objects(self):
        """Should extract only the first complete JSON object."""
        text = 'First: {"a": 1} and second: {"b": 2}'
        result = extract_first_json_object(text)
        assert result == '{"a": 1}'

    def test_nested_objects(self):
        """Handle nested JSON objects correctly."""
        text = '{"outer": {"inner": {"deep": 1}}, "val": 2}'
        result = extract_first_json_object(text)
        assert result == '{"outer": {"inner": {"deep": 1}}, "val": 2}'

    def test_braces_in_strings(self):
        """Ignore braces inside quoted strings."""
        text = '{"text": "some {braces} here", "num": 1}'
        result = extract_first_json_object(text)
        assert result == '{"text": "some {braces} here", "num": 1}'

    def test_escaped_quotes_in_strings(self):
        """Handle escaped quotes inside strings."""
        text = '{"text": "say \\"hello\\"", "num": 1}'
        result = extract_first_json_object(text)
        assert result == '{"text": "say \\"hello\\"", "num": 1}'

    def test_newlines_in_json(self):
        """Handle JSON with newlines."""
        text = '''Here is the JSON:
{
    "novelty": 2,
    "utility": 1
}
Done.'''
        result = extract_first_json_object(text)
        assert '"novelty": 2' in result
        assert '"utility": 1' in result

    def test_no_json_raises(self):
        """Raise ValueError when no JSON object found."""
        with pytest.raises(ValueError, match="No JSON object found"):
            extract_first_json_object("no json here")

    def test_unbalanced_braces_raises(self):
        """Raise ValueError for unbalanced braces."""
        with pytest.raises(ValueError, match="unbalanced braces"):
            extract_first_json_object('{"incomplete": 1')


class TestParseScoreResponse:
    """Tests for score response parsing and validation."""

    def test_valid_json(self, valid_score_response):
        """Parse valid JSON score response."""
        result = parse_score_response(valid_score_response)
        assert result['novelty'] == 2
        assert result['utility'] == 1
        assert result['results'] == 2
        assert result['access'] == 1
        assert 'reasoning' in result

    def test_markdown_wrapped_json(self, valid_score_with_markdown):
        """Parse JSON wrapped in markdown code block."""
        result = parse_score_response(valid_score_with_markdown)
        assert result['novelty'] == 3
        assert result['access'] == 0

    def test_json_with_preamble(self, score_with_preamble):
        """Parse JSON with LLM commentary before/after."""
        result = parse_score_response(score_with_preamble)
        assert result['novelty'] == 1
        assert result['utility'] == 0

    def test_accessibility_normalized_to_access(self):
        """Old 'accessibility' field should be normalized to 'access'."""
        text = '{"novelty": 2, "utility": 1, "results": 1, "accessibility": 1, "reasoning": "Good paper with code."}'
        result = parse_score_response(text)
        assert result['access'] == 1

    def test_novelty_out_of_range_raises(self):
        """Reject novelty score > 3."""
        text = '{"novelty": 5, "utility": 1, "results": 2, "access": 1, "reasoning": "Invalid score."}'
        with pytest.raises(ValueError, match="novelty out of range"):
            parse_score_response(text)

    def test_utility_out_of_range_raises(self):
        """Reject utility score > 1."""
        text = '{"novelty": 2, "utility": 3, "results": 2, "access": 1, "reasoning": "Invalid score."}'
        with pytest.raises(ValueError, match="utility out of range"):
            parse_score_response(text)

    def test_results_out_of_range_raises(self):
        """Reject results score > 2."""
        text = '{"novelty": 2, "utility": 1, "results": 5, "access": 1, "reasoning": "Invalid score."}'
        with pytest.raises(ValueError, match="results out of range"):
            parse_score_response(text)

    def test_access_out_of_range_raises(self):
        """Reject access score > 1."""
        text = '{"novelty": 2, "utility": 1, "results": 2, "access": 2, "reasoning": "Invalid score."}'
        with pytest.raises(ValueError, match="access out of range"):
            parse_score_response(text)

    def test_negative_score_raises(self):
        """Reject negative scores."""
        text = '{"novelty": -1, "utility": 1, "results": 2, "access": 1, "reasoning": "Negative score."}'
        with pytest.raises(ValueError, match="novelty out of range"):
            parse_score_response(text)

    def test_missing_reasoning_raises(self):
        """Reject response without reasoning field."""
        text = '{"novelty": 2, "utility": 1, "results": 2, "access": 1}'
        with pytest.raises(ValueError, match="missing/short reasoning"):
            parse_score_response(text)

    def test_short_reasoning_raises(self):
        """Reject response with too-short reasoning."""
        text = '{"novelty": 2, "utility": 1, "results": 2, "access": 1, "reasoning": "OK"}'
        with pytest.raises(ValueError, match="missing/short reasoning"):
            parse_score_response(text)

    def test_non_integer_score_raises(self):
        """Reject non-integer scores."""
        text = '{"novelty": 2.5, "utility": 1, "results": 2, "access": 1, "reasoning": "Float score invalid."}'
        with pytest.raises(ValueError, match="novelty out of range"):
            parse_score_response(text)
