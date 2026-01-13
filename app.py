import os
import re
import sqlite3
import logging
from math import ceil
from contextlib import contextmanager
from typing import Optional
from flask import Flask, jsonify, request, send_from_directory, Response
import requests
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

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
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

DB_PATH = os.path.join("data", "papers.db")
BREAKDOWN_MAX = {"Novelty": 3, "Utility": 1, "Results": 2, "Access": 1}
CARDS_PER_PAGE = 15

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
    cats: Optional[list[str]] = None,
    only_summarized: bool = False,
    min_score: int = 0,
    only_scored: bool = False,
    sort: str = "newest",
    page: int = 0
) -> dict:
    """
    Load papers from database with filtering, sorting, and pagination.

    Args:
        search: Search term for title/abstract/keywords
        cats: List of category filters
        only_summarized: Only show papers with summaries
        min_score: Minimum excitement score (0-7)
        only_scored: Only show scored papers
        sort: Sort order ('newest' or 'score')
        page: Page number (0-indexed)

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
@limiter.limit("100 per minute")
def get_papers():
    """Fetch papers with filtering and pagination."""
    # Parse and validate query parameters
    search = request.args.get('search', '')[:200]  # Limit search length
    cats = request.args.getlist('category')[:20]  # Limit categories
    only_summarized = request.args.get('onlySummarized', 'false') == 'true'
    min_score = max(0, min(7, request.args.get('minScore', 0, type=int)))  # Clamp 0-7
    only_scored = request.args.get('onlyScored', 'false') == 'true'
    sort = request.args.get('sort', 'score')
    page = max(0, request.args.get('page', 0, type=int))  # No negative pages

    data = load_rows(
        search=search,
        cats=cats,
        only_summarized=only_summarized,
        min_score=min_score,
        only_scored=only_scored,
        sort=sort,
        page=page
    )
    return jsonify(data)

@app.route('/api/categories')
@limiter.limit("60 per minute")
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
@limiter.limit("30 per minute")  # Lower limit - PDF proxy is expensive
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
        resp = requests.get(url, stream=True, timeout=15, headers=headers_req)
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
        logger.info("Starting Flask server on http://localhost:5001")
        app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true", port=5001)