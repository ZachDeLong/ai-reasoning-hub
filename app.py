import os, sqlite3, datetime
from math import ceil
from flask import Flask, jsonify, request, send_from_directory, Response
import requests
from flask_cors import CORS

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app) # Allow frontend to fetch data

DB_PATH = os.path.join("data", "papers.db")
BREAKDOWN_MAX = {"Novelty": 3, "Impact": 4, "Results": 2, "Access": 1}
CARDS_PER_PAGE = 15

# --- Database Logic (Adapted from your Streamlit app) ---

def load_rows(search="", cats=None, only_summarized=False, min_score=0, only_scored=False, sort="newest", page=0):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    
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
        # Assuming your DB has these columns, as from your original file
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

    # --- Get Total Count for Pagination ---
    count_sql = f"SELECT COUNT(id) {sql}"
    total_papers = 0
    try:
        total_papers = conn.execute(count_sql, params).fetchone()[0]
    except Exception as e:
        print(f"Error counting papers: {e}")
        
    total_pages = max(1, ceil(total_papers / CARDS_PER_PAGE))

    # --- Get Paginated Data ---
    order_clause = "date DESC"
    if sort == "score":
        order_clause = "COALESCE(excitement_score,0) DESC, date DESC"
    
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
    params.extend([CARDS_PER_PAGE, offset])
    
    rows = []
    try:
        rows = [dict(r) for r in conn.execute(data_sql, params).fetchall()]
    except Exception as e:
        print(f"Error fetching paper rows: {e}")
        
    conn.close()
    
    return {
        "papers": rows,
        "total_pages": total_pages,
        "results_count": total_papers
    }

# --- API Endpoints ---

@app.route('/api/papers')
def get_papers():
    # Parse query parameters from the frontend's request
    search = request.args.get('search', '')
    cats = request.args.getlist('category') # Gets a list, e.g. ['LLM Training', 'Survey']
    only_summarized = request.args.get('onlySummarized', 'false') == 'true'
    min_score = request.args.get('minScore', 0, type=int)
    only_scored = request.args.get('onlyScored', 'false') == 'true'
    sort = request.args.get('sort', 'score')
    page = request.args.get('page', 0, type=int)

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
def get_categories():
    # Provide the list of categories for the filter dropdown
    conn = sqlite3.connect(DB_PATH)
    cats_all = []
    try:
        cats_all = [
            r[0] for r in conn.execute(
                "SELECT DISTINCT reasoning_category FROM papers "
                "WHERE reasoning_category IS NOT NULL AND reasoning_category <> '' "
                "ORDER BY reasoning_category"
            )
        ]
    except Exception as e:
        print(f"Error fetching categories: {e}")
    conn.close()
    return jsonify(cats_all)

@app.route('/api/pdf/<arxiv_id>')
def proxy_pdf(arxiv_id):
    """Proxy PDF requests to avoid CORS/iframe issues with arXiv"""
    print(f"DEBUG: proxy_pdf called for {arxiv_id}")
    
    # Basic validation of arxiv_id to prevent arbitrary URL access
    safe_id = "".join(c for c in arxiv_id if c.isalnum() or c in ".-")
    
    url = f"https://arxiv.org/pdf/{safe_id}.pdf"
    print(f"DEBUG: Fetching from {url}")
    
    try:
        # Stream the response so we don't load the whole PDF into memory
        # Add a User-Agent to look like a browser, just in case
        headers_req = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, stream=True, timeout=15, headers=headers_req)
        print(f"DEBUG: ArXiv response status: {resp.status_code}")
        resp.raise_for_status()
        
        # Exclude some headers that might cause issues or are not relevant
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        headers = [(name, value) for (name, value) in resp.raw.headers.items()
                   if name.lower() not in excluded_headers]
                   
        return Response(resp.iter_content(chunk_size=8192),
                        status=resp.status_code,
                        headers=headers)
    except Exception as e:
        print(f"Error proxying PDF: {e}")
        return jsonify({"error": "Failed to fetch PDF"}), 500

@app.route('/')
def serve_index():
    # This serves your `index.html` file as the main page
    response = send_from_directory('.', 'index.html')
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

if __name__ == '__main__':
    # Make sure your database is in a 'data' folder next to this app.py
    if not os.path.exists(DB_PATH):
        print("="*50)
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Please make sure your 'papers.db' file is inside a 'data' folder.")
        print("="*50)
    else:
        print("Starting Flask server on http://localhost:5001")
        app.run(debug=True, port=5001) # Runs on http://localhost:5001