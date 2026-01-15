"""Pytest fixtures for AI Reasoning Hub tests."""

import os
import sys
import pytest

# Add project root and tools to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'tools'))


@pytest.fixture
def app():
    """Create Flask test client."""
    from app import app as flask_app
    flask_app.config['TESTING'] = True
    return flask_app


@pytest.fixture
def client(app):
    """Create Flask test client."""
    return app.test_client()


@pytest.fixture
def valid_score_response():
    """Valid JSON response from LLM scoring."""
    return '''{
        "novelty": 2,
        "utility": 1,
        "results": 2,
        "access": 1,
        "reasoning": "Strong methodology with clear improvements over baselines."
    }'''


@pytest.fixture
def valid_score_with_markdown():
    """Valid score wrapped in markdown code block."""
    return '''```json
{
    "novelty": 3,
    "utility": 1,
    "results": 2,
    "access": 0,
    "reasoning": "Novel approach to reasoning that could change the field."
}
```'''


@pytest.fixture
def score_with_preamble():
    """Score JSON preceded by LLM commentary."""
    return '''Based on my analysis of this paper, here is my evaluation:

{
    "novelty": 1,
    "utility": 0,
    "results": 1,
    "access": 1,
    "reasoning": "Incremental work but well executed with open code."
}

This paper makes a modest contribution to the field.'''
