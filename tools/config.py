"""
Centralized configuration for AI Reasoning Hub.

All magic numbers and configurable values in one place.
Environment variables override defaults where applicable.
"""

import os

# =============================================================================
# DATABASE
# =============================================================================
DB_PATH = os.getenv("PROJECTS_DB", "data/papers.db")

# =============================================================================
# SERVER / API
# =============================================================================
SERVER_PORT = int(os.getenv("PORT", "5001"))
FLASK_DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"

# Rate limits (Flask-Limiter format)
RATE_LIMIT_DEFAULT = ["200 per day", "50 per hour"]
RATE_LIMIT_PAPERS = "100 per minute"
RATE_LIMIT_CATEGORIES = "60 per minute"
RATE_LIMIT_EXPORT = "20 per hour"
RATE_LIMIT_PAPER_DETAIL = "60 per minute"
RATE_LIMIT_PDF_PROXY = "30 per minute"
RATE_LIMIT_AUTHOR_COUNTS = "30 per minute"

# Request timeouts (seconds)
REQUEST_TIMEOUT = 15
OLLAMA_TIMEOUT = 120

# =============================================================================
# LLM PROVIDERS & MODELS
# =============================================================================
SUMMARY_PROVIDER = os.getenv("SUMMARY_PROVIDER", "openai").lower()

# Model names
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
OPENAI_TRIAGE_MODEL = "gpt-4o-mini"  # Cheap model for triage fallback
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-latest")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_ENDPOINT = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# LLM generation parameters
LLM_TEMPERATURE = 0.2
LLM_TRIAGE_TEMPERATURE = 0.1
LLM_MAX_TOKENS = 2000
LLM_TRIAGE_MAX_TOKENS = 100

# Retry configuration (tenacity)
RETRY_MULTIPLIER = 2
RETRY_MIN_WAIT = 5
RETRY_MAX_WAIT = 90
RETRY_MAX_ATTEMPTS = 8

# =============================================================================
# BATCH PROCESSING
# =============================================================================
SUMMARY_BATCH_SIZE = int(os.getenv("SUMMARY_BATCH", "10"))
SCORE_BATCH_SIZE = int(os.getenv("SCORE_BATCH", "10"))
REFRESH_BATCH_SIZE = 100  # Larger batch for refresh operations

# =============================================================================
# SCORING RUBRIC
# =============================================================================
# Score ranges for each dimension
SCORE_RANGES = {
    "novelty": (0, 3),
    "utility": (0, 1),
    "results": (0, 2),
    "access": (0, 1),
}

# Max values for UI display (capitalized keys for frontend)
BREAKDOWN_MAX = {
    "Novelty": 3,
    "Utility": 1,
    "Results": 2,
    "Access": 1,
}

# Total score range
SCORE_MIN = 0
SCORE_MAX = 7  # Sum of all max values

# Tier thresholds
TIER_THRESHOLDS = {
    "S": 7,      # Groundbreaking
    "A": 5,      # Strong (5-6)
    "B": 4,      # Solid
    "C": 2,      # Marginal (2-3)
    "D": 0,      # Weak (0-1)
}

# =============================================================================
# UI / PAGINATION
# =============================================================================
CARDS_PER_PAGE = 15
STREAMLIT_MAX_RESULTS = 500
STREAMLIT_DEFAULT_RESULTS = 200

# Input length limits (security)
SEARCH_MAX_LENGTH = 200
AUTHOR_MAX_LENGTH = 100
MAX_CATEGORIES_FILTER = 20

# Export limits
EXPORT_MAX_PAPERS = 1000
AUTHOR_COUNT_LIMIT = 500

# =============================================================================
# CONTENT LIMITS
# =============================================================================
SUMMARY_TRUNCATE_LENGTH = 1500  # Max chars of summary for scoring prompt
MIN_REASONING_LENGTH = 8       # Minimum chars for valid reasoning field
