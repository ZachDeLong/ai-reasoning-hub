# AI Reasoning Hub

An automated research tool that collects, summarizes, and scores AI reasoning papers daily. Papers are fetched from HuggingFace and arXiv, triaged for relevance by Gemini, summarized by GPT-4o or Claude, and scored on a 7-point scale.

**Live:** [reasoning.nexus](https://reasoning.nexus)

## How It Works

```
HuggingFace Daily Papers
        │
        ▼
   Gemini Flash ──── filters for reasoning relevance
        │
        ▼
  GPT-4o / Claude ── generates structured summaries
        │
        ▼
   Scoring Engine ── rates Novelty (0-3), Utility (0-1), Results (0-2), Access (0-1)
        │
        ▼
   Flask + React ─── serves the frontend with search, filters, and PDF viewing
```

Papers are collected daily via GitHub Actions and auto-deployed to Render.

## Frontend

- **Paper list** with score, title, authors, TLDR, and inline actions
- **Expand any paper** to read the full summary alongside the embedded PDF
- **Trends page** with tier distribution (S/A/B/C/D), score breakdown averages, and charts
- **Reading lists** (To Read, Reading, Completed) stored in localStorage
- **Bookmarks** for quick saving
- **Keyboard shortcuts** (j/k to navigate, Enter to expand, s to save, o to open)
- **Filtering** by topic, score, author, date, and reading list
- **Dark mode** with system preference detection
- **Mobile** bottom nav and slide-out filter drawer
- **CSV export** and shareable filtered URLs

## Quick Start

```bash
git clone https://github.com/ZachDeLong/ai-reasoning-hub.git
cd ai-reasoning-hub
pip install -r requirements.txt
cp .env.example .env  # add your API keys
python app.py          # http://localhost:5001
```

See `.env.example` for required keys (Google for triage, OpenAI or Anthropic for summaries).

## Pipeline

Run the full collection pipeline manually:

```bash
python tools/collect_weekly_papers.py   # fetch from HuggingFace
python tools/summarize_papers.py        # generate summaries
python tools/score_papers.py            # score papers
```

Or run everything at once:

```bash
python tools/pipeline.py
```

The GitHub Actions workflow (`.github/workflows/collect-papers.yml`) runs this daily at 6 AM UTC.

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/papers` | Papers with pagination, search, filters, sort |
| `GET /api/papers/stats` | All papers for trends (no pagination) |
| `GET /api/categories` | Category list |
| `GET /api/pdf/<arxiv_id>` | Proxied arXiv PDF |
| `GET /api/bibtex/<arxiv_id>` | BibTeX citation |
| `GET /api/export/csv` | CSV export with current filters |

All endpoints are rate-limited.

## Project Structure

```
ai-reasoning-hub/
├── app.py                          # Flask backend + API
├── index.html                      # React frontend
├── about.html                      # About / scoring methodology
├── render.yaml                     # Render deployment config
├── frontend/                       # React + TypeScript components
├── .github/workflows/
│   └── collect-papers.yml          # Daily collection via GitHub Actions
├── backend/
│   ├── fetch_arxiv.py              # arXiv API
│   ├── search.py                   # Search utilities
│   └── setup_db.py                 # Database initialization
├── tools/
│   ├── collect_weekly_papers.py    # Paper fetching
│   ├── summarize_papers.py         # LLM summarization
│   ├── score_papers.py             # Scoring engine
│   ├── llm_summary.py             # LLM provider wrapper
│   └── pipeline.py                 # Full pipeline runner
├── migrations/                     # Database migrations
├── tests/                          # Test suite
└── data/
    └── papers.db                   # SQLite database
```

## Scoring

Each paper is scored out of 7 points:

| Dimension | Max | What it measures |
|-----------|-----|-----------------|
| Novelty | 3 | Originality of the approach |
| Utility | 1 | Practical value for researchers |
| Results | 2 | Strength of findings |
| Access | 1 | Public code/data availability |

Tiers: **S** (7) / **A** (5-6) / **B** (4) / **C** (2-3) / **D** (0-1)

## License

MIT
