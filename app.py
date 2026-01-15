import os
import re
import csv
import sqlite3
import logging
import sys
from io import StringIO
from math import ceil
from contextlib import contextmanager
from typing import Optional
from flask import Flask, jsonify, request, send_from_directory, Response
import requests
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Add tools directory to path for config import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tools'))
from config import (
    DB_PATH, BREAKDOWN_MAX, CARDS_PER_PAGE, SERVER_PORT, FLASK_DEBUG,
    RATE_LIMIT_DEFAULT, RATE_LIMIT_PAPERS, RATE_LIMIT_CATEGORIES,
    RATE_LIMIT_EXPORT, RATE_LIMIT_PAPER_DETAIL, RATE_LIMIT_PDF_PROXY,
    RATE_LIMIT_AUTHOR_COUNTS, REQUEST_TIMEOUT, SEARCH_MAX_LENGTH,
    AUTHOR_MAX_LENGTH, MAX_CATEGORIES_FILTER, EXPORT_MAX_PAPERS,
    AUTHOR_COUNT_LIMIT, SCORE_MIN, SCORE_MAX
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Rate limiting - prevent API abuse
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=RATE_LIMIT_DEFAULT,
    storage_uri="memory://"
)

# --- Database helpers ---

@contextmanager
def get_db_connection():
    """Context manager for database connections - ensures proper cleanup."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# Allowed sort options - prevents SQL injection
ALLOWED_SORT_OPTIONS = {
    "newest": "date DESC",
    "score": "COALESCE(excitement_score,0) DESC, date DESC"
}

# Strict arxiv ID pattern (e.g., 2401.12345 or 2401.12345v1)
ARXIV_ID_PATTERN = re.compile(r'^\d{4}\.\d{4,5}(v\d+)?$')

def load_rows(
    search: str = "",
    author: str = "",
    cats: Optional[list[str]] = None,
    only_summarized: bool = False,
    min_score: int = 0,
    only_scored: bool = False,
    sort: str = "newest",
    page: int = 0,
    date_from: str = "",
    date_to: str = ""
) -> dict:
    """
    Load papers from database with filtering, sorting, and pagination.

    Args:
        search: Search term for title/abstract/keywords
        author: Author name filter
        cats: List of category filters
        only_summarized: Only show papers with summaries
        min_score: Minimum excitement score (0-7)
        only_scored: Only show scored papers
        sort: Sort order ('newest' or 'score')
        page: Page number (0-indexed)
        date_from: Filter papers from this date (YYYY-MM-DD)
        date_to: Filter papers until this date (YYYY-MM-DD)

    Returns:
        Dict with 'papers', 'total_pages', and 'results_count'
    """
    # Validate sort option - default to newest if invalid
    if sort not in ALLOWED_SORT_OPTIONS:
        sort = "newest"

    # Base query
    sql = "FROM papers WHERE 1=1"
    params = []

    # Category filter
    if cats:
        placeholders = ",".join(["?"] * len(cats))
        sql += f" AND reasoning_category IN ({placeholders})"
        params.extend(cats)

    # Search
    if search:
        like = f"%{search}%"
        sql += " AND (title LIKE ? OR abstract LIKE ? OR keywords LIKE ? OR tldr LIKE ? OR summary_md LIKE ?)"
        params.extend([like, like, like, like, like])

    # Author filter
    if author:
        sql += " AND authors LIKE ?"
        params.append(f"%{author}%")

    # Date range filter
    if date_from:
        sql += " AND date >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND date <= ?"
        params.append(date_to)

    # Toggles
    if only_summarized:
        sql += " AND tldr <> ''"
    if only_scored:
        sql += " AND COALESCE(excitement_score, 0) > 0"
    if min_score:
        sql += " AND COALESCE(excitement_score, 0) >= ?"
        params.append(min_score)

    # Always filter out skipped papers (irrelevant ones)
    sql += " AND summary_md NOT LIKE '[Skipped%'"

    total_papers = 0
    rows = []

    with get_db_connection() as conn:
        # Get Total Count for Pagination
        count_sql = f"SELECT COUNT(id) {sql}"
        try:
            total_papers = conn.execute(count_sql, params).fetchone()[0]
        except sqlite3.Error as e:
            logger.error(f"Database error counting papers: {e}")

        total_pages = max(1, ceil(total_papers / CARDS_PER_PAGE))

        # Get Paginated Data
        order_clause = ALLOWED_SORT_OPTIONS[sort]
        offset = page * CARDS_PER_PAGE

        data_sql = f"""
        SELECT
          id, COALESCE(arxiv_id, '') AS arxiv_id, title, authors, date,
          COALESCE(reasoning_category, '') AS reasoning_category,
          arxiv_link, COALESCE(tldr, '') AS tldr,
          COALESCE(summary_md, '') AS summary_md,
          COALESCE(excitement_score, 0) AS excitement_score,
          COALESCE(excitement_reasoning, '') AS excitement_reasoning,
          COALESCE(score_breakdown, '') AS score_breakdown,
          COALESCE(last_scored_at, '') AS last_scored_at
        {sql}
        ORDER BY {order_clause}
        LIMIT ? OFFSET ?
        """
        query_params = params + [CARDS_PER_PAGE, offset]

        try:
            rows = [dict(r) for r in conn.execute(data_sql, query_params).fetchall()]
        except sqlite3.Error as e:
            logger.error(f"Database error fetching papers: {e}")

    return {
        "papers": rows,
        "total_pages": total_pages,
        "results_count": total_papers
    }

# --- API Endpoints ---

@app.route('/api/papers')
@limiter.limit(RATE_LIMIT_PAPERS)
def get_papers():
    """Fetch papers with filtering and pagination."""
    # Parse and validate query parameters
    search = request.args.get('search', '')[:SEARCH_MAX_LENGTH]
    author = request.args.get('author', '')[:AUTHOR_MAX_LENGTH]
    cats = request.args.getlist('category')[:MAX_CATEGORIES_FILTER]
    only_summarized = request.args.get('onlySummarized', 'false') == 'true'
    min_score = max(SCORE_MIN, min(SCORE_MAX, request.args.get('minScore', 0, type=int)))
    only_scored = request.args.get('onlyScored', 'false') == 'true'
    sort = request.args.get('sort', 'score')
    page = max(0, request.args.get('page', 0, type=int))  # No negative pages
    date_from = request.args.get('dateFrom', '')[:10]  # YYYY-MM-DD format
    date_to = request.args.get('dateTo', '')[:10]

    data = load_rows(
        search=search,
        author=author,
        cats=cats,
        only_summarized=only_summarized,
        min_score=min_score,
        only_scored=only_scored,
        sort=sort,
        page=page,
        date_from=date_from,
        date_to=date_to
    )
    return jsonify(data)

@app.route('/api/papers/stats')
@limiter.limit(RATE_LIMIT_AUTHOR_COUNTS)
def get_papers_stats():
    """Fetch all papers for stats/trends (lightweight, no pagination)."""
    with get_db_connection() as conn:
        rows = conn.execute("""
            SELECT
                id, title, authors, date,
                COALESCE(reasoning_category, '') AS reasoning_category,
                arxiv_link,
                COALESCE(excitement_score, 0) AS excitement_score,
                COALESCE(score_breakdown, '') AS score_breakdown
            FROM papers
            WHERE summary_md IS NOT NULL AND summary_md != ''
            ORDER BY excitement_score DESC
            LIMIT 500
        """).fetchall()
        return jsonify({"papers": [dict(r) for r in rows]})

@app.route('/api/trends')
@limiter.limit(RATE_LIMIT_CATEGORIES)
def get_trends():
    """Get category trends over time for visualization."""
    with get_db_connection() as conn:
        # Get papers with dates and categories
        rows = conn.execute("""
            SELECT
                date,
                reasoning_category,
                excitement_score
            FROM papers
            WHERE date IS NOT NULL
              AND reasoning_category IS NOT NULL
              AND reasoning_category != ''
            ORDER BY date
        """).fetchall()

        if not rows:
            return jsonify({"weekly": {}, "categories": {}, "growth": {}})

        # Group by week and category
        from collections import defaultdict
        weekly_counts = defaultdict(lambda: defaultdict(int))
        category_scores = defaultdict(list)
        category_total = defaultdict(int)

        for row in rows:
            date_str = row['date'][:10] if row['date'] else None
            if not date_str:
                continue

            # Get ISO week (YYYY-WXX format)
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(date_str)
                week_key = f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"
            except:
                continue

            cat = row['reasoning_category']
            weekly_counts[week_key][cat] += 1
            category_total[cat] += 1
            if row['excitement_score']:
                category_scores[cat].append(row['excitement_score'])

        # Calculate average scores per category
        category_avg_scores = {
            cat: round(sum(scores) / len(scores), 1) if scores else 0
            for cat, scores in category_scores.items()
        }

        # Calculate growth (compare last 2 weeks vs previous 2 weeks)
        sorted_weeks = sorted(weekly_counts.keys())
        growth = {}
        if len(sorted_weeks) >= 2:
            recent_weeks = sorted_weeks[-2:] if len(sorted_weeks) >= 2 else sorted_weeks[-1:]
            earlier_weeks = sorted_weeks[:-2] if len(sorted_weeks) > 2 else []

            for cat in category_total.keys():
                recent_count = sum(weekly_counts[w].get(cat, 0) for w in recent_weeks)
                earlier_count = sum(weekly_counts[w].get(cat, 0) for w in earlier_weeks) if earlier_weeks else 0

                if earlier_count > 0:
                    growth[cat] = round((recent_count - earlier_count) / earlier_count * 100)
                elif recent_count > 0:
                    growth[cat] = 100  # New category
                else:
                    growth[cat] = 0

        return jsonify({
            "weekly": {week: dict(cats) for week, cats in weekly_counts.items()},
            "categories": dict(category_total),
            "avg_scores": category_avg_scores,
            "growth": growth,
            "weeks": sorted_weeks
        })

@app.route('/api/export/csv')
@limiter.limit(RATE_LIMIT_EXPORT)
def export_csv():
    """Export filtered papers as CSV."""
    # Parse filters (same as get_papers)
    search = request.args.get('search', '')[:SEARCH_MAX_LENGTH]
    author = request.args.get('author', '')[:AUTHOR_MAX_LENGTH]
    cats = request.args.getlist('category')[:MAX_CATEGORIES_FILTER]
    only_summarized = request.args.get('onlySummarized', 'false') == 'true'
    min_score = max(SCORE_MIN, min(SCORE_MAX, request.args.get('minScore', 0, type=int)))
    only_scored = request.args.get('onlyScored', 'false') == 'true'
    sort = request.args.get('sort', 'score')

    # Get all results without pagination (limit to 1000 for safety)
    data = load_rows(
        search=search, author=author, cats=cats,
        only_summarized=only_summarized, min_score=min_score,
        only_scored=only_scored, sort=sort, page=0
    )

    # Create CSV
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        'arxiv_id', 'title', 'authors', 'date', 'reasoning_category',
        'tldr', 'excitement_score', 'arxiv_link'
    ])
    writer.writeheader()
    for paper in data['papers']:
        writer.writerow({
            'arxiv_id': paper.get('arxiv_id', ''),
            'title': paper.get('title', ''),
            'authors': paper.get('authors', ''),
            'date': paper.get('date', ''),
            'reasoning_category': paper.get('reasoning_category', ''),
            'tldr': paper.get('tldr', ''),
            'excitement_score': paper.get('excitement_score', 0),
            'arxiv_link': paper.get('arxiv_link', '')
        })

    response = Response(output.getvalue(), mimetype='text/csv')
    response.headers['Content-Disposition'] = 'attachment; filename=papers_export.csv'
    return response

@app.route('/api/bibtex/<arxiv_id>')
@limiter.limit(RATE_LIMIT_PAPER_DETAIL)
def get_bibtex(arxiv_id: str) -> Response:
    """Generate BibTeX entry for a paper."""
    if not ARXIV_ID_PATTERN.match(arxiv_id):
        return jsonify({"error": "Invalid arxiv ID format"}), 400

    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT arxiv_id, title, authors, date FROM papers WHERE arxiv_id = ?",
            (arxiv_id,)
        ).fetchone()

        if not row:
            return jsonify({"error": "Paper not found"}), 404

        paper = dict(row)

        # Parse authors: "John Doe, Jane Smith, et al." -> "Doe, John and Smith, Jane"
        authors_raw = paper.get('authors', '') or ''
        authors_list = [a.strip() for a in authors_raw.replace(', et al.', '').split(',') if a.strip()]
        bibtex_authors = ' and '.join(authors_list)

        # Extract year from date
        year = paper.get('date', '')[:4] if paper.get('date') else 'unknown'

        # Create cite key
        first_author = authors_list[0].split()[-1].lower() if authors_list else 'unknown'
        cite_key = f"{first_author}{year}_{arxiv_id.replace('.', '')}"

        bibtex = f"""@article{{{cite_key},
  title = {{{paper.get('title', '')}}},
  author = {{{bibtex_authors}}},
  year = {{{year}}},
  eprint = {{{arxiv_id}}},
  archivePrefix = {{arXiv}},
  primaryClass = {{cs.AI}},
  url = {{https://arxiv.org/abs/{arxiv_id}}}
}}"""

        return Response(bibtex, mimetype='text/plain')

@app.route('/api/categories')
@limiter.limit(RATE_LIMIT_CATEGORIES)
def get_categories() -> Response:
    """Provide the list of categories for the filter dropdown."""
    cats_all = []
    with get_db_connection() as conn:
        try:
            cats_all = [
                r[0] for r in conn.execute(
                    "SELECT DISTINCT reasoning_category FROM papers "
                    "WHERE reasoning_category IS NOT NULL AND reasoning_category <> '' "
                    "ORDER BY reasoning_category"
                )
            ]
        except sqlite3.Error as e:
            logger.error(f"Database error fetching categories: {e}")
    return jsonify(cats_all)

@app.route('/api/pdf/<arxiv_id>')
@limiter.limit(RATE_LIMIT_PDF_PROXY)
def proxy_pdf(arxiv_id: str) -> Response:
    """Proxy PDF requests to avoid CORS/iframe issues with arXiv."""
    # Strict validation: arxiv IDs must match pattern like 2401.12345 or 2401.12345v1
    if not ARXIV_ID_PATTERN.match(arxiv_id):
        return jsonify({"error": "Invalid arxiv ID format"}), 400

    url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

    try:
        headers_req = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        }
        resp = requests.get(url, stream=True, timeout=REQUEST_TIMEOUT, headers=headers_req)
        resp.raise_for_status()

        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for (name, value) in resp.raw.headers.items()
                   if name.lower() not in excluded_headers]

        return Response(resp.iter_content(chunk_size=8192),
                        status=resp.status_code,
                        headers=headers)
    except requests.Timeout:
        logger.warning(f"Timeout fetching PDF for {arxiv_id}")
        return jsonify({"error": "Request timed out"}), 504
    except requests.RequestException as e:
        logger.error(f"Error proxying PDF for {arxiv_id}: {e}")
        return jsonify({"error": "Failed to fetch PDF"}), 500

@app.route('/')
def serve_index():
    # This serves your `index.html` file as the main page
    response = send_from_directory('.', 'index.html')
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

@app.route('/about')
def serve_about():
    response = send_from_directory('.', 'about.html')
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

if __name__ == '__main__':
    if not os.path.exists(DB_PATH):
        logger.error(f"Database not found at {DB_PATH}")
        logger.error("Please make sure your 'papers.db' file is inside a 'data' folder.")
    else:
        logger.info(f"Starting Flask server on http://localhost:{SERVER_PORT}")
        app.run(debug=FLASK_DEBUG, port=SERVER_PORT)