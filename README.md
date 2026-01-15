# AI Reasoning Hub

A web application for tracking, scoring, and summarizing AI reasoning research papers from arXiv and HuggingFace.

## Features

- **Paper Collection**: Automatically fetches trending AI papers from HuggingFace Daily Papers
- **AI Triage**: Uses Gemini Flash to filter papers for reasoning relevance
- **AI Summarization**: Generates structured summaries using OpenAI, Anthropic, or Ollama
- **Excitement Scoring**: Rates papers on Novelty, Utility, Results, and Access
- **Web Interface**: React-based frontend with filtering, search, and PDF viewing
- **API**: Flask REST API with rate limiting and input validation

## Quick Start

### Prerequisites

- Python 3.11+
- SQLite
- API keys for LLM providers (OpenAI, Anthropic, and/or Google)

### Installation

```bash
# Clone the repository
git clone https://github.com/ZachDeLong/ai-reasoning-hub.git
cd ai-reasoning-hub

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
export GOOGLE_API_KEY="your-gemini-key"      # For triage
export OPENAI_API_KEY="your-openai-key"      # For summaries (default)
# OR
export ANTHROPIC_API_KEY="your-anthropic-key"
export SUMMARY_PROVIDER="anthropic"
```

### Running the App

**Flask Web App (Recommended)**
```bash
python app.py
# Open http://localhost:5001
```

**Streamlit App**
```bash
streamlit run app_streamlit.py
# Open http://localhost:8501
```

### Collecting Papers

```bash
# Fetch new papers from HuggingFace
python tools/collect_weekly_papers.py

# Generate summaries for new papers
python tools/summarize_papers.py

# Score papers
python tools/score_papers.py
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_DEBUG` | `false` | Enable Flask debug mode |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model for summaries |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model for triage |
| `PROJECTS_DB` | `data/papers.db` | SQLite database path |
| `SUMMARY_BATCH` | `10` | Papers per batch |

## API Endpoints

| Endpoint | Method | Rate Limit | Description |
|----------|--------|------------|-------------|
| `/api/papers` | GET | 100/min | Fetch papers with filters |
| `/api/categories` | GET | 60/min | Get category list |
| `/api/pdf/<arxiv_id>` | GET | 30/min | Proxy arXiv PDFs |

### Query Parameters for `/api/papers`

- `search`: Search term (max 200 chars)
- `category`: Filter by category (repeatable)
- `minScore`: Minimum score 0-7
- `onlySummarized`: true/false
- `onlyScored`: true/false
- `sort`: `newest` or `score`
- `page`: Page number (0-indexed)

## Project Structure

```
ai-reasoning-hub/
├── app.py              # Flask backend
├── app_streamlit.py    # Streamlit frontend
├── index.html          # Static React frontend
├── about.html          # About page
├── requirements.txt    # Python dependencies
├── data/
│   └── papers.db       # SQLite database
├── backend/
│   ├── fetch_arxiv.py  # arXiv fetching
│   ├── search.py       # Search utilities
│   └── setup_db.py     # Database setup
└── tools/
    ├── collect_weekly_papers.py  # Paper collection
    ├── summarize_papers.py       # AI summarization
    ├── score_papers.py           # Paper scoring
    ├── llm_summary.py            # LLM API wrapper
    └── pipeline.py               # Full pipeline
```

## Development

```bash
# Run with debug mode
FLASK_DEBUG=true python app.py

# Run in dev container
# Uses .devcontainer/devcontainer.json
```

## License

MIT
