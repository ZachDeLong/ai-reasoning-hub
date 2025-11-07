import os, sqlite3, datetime as dt, re
import arxiv   # installed earlier with pip

ROOT = os.path.dirname(os.path.dirname(__file__))
DB_PATH = os.path.join(ROOT, "data", "papers.db")

def ensure_db():
    if not os.path.exists(DB_PATH):
        raise SystemExit("Database not found. Run setup_db.py first.")

def insert_rows(rows):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executemany("""
        INSERT OR IGNORE INTO papers
        (arxiv_id, title, authors, date, abstract, arxiv_link, summary,
         reasoning_category, keywords, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()

def guess_category(text):
    text = text.lower()
    if "chain of thought" in text or "cot" in text:
        return "chain-of-thought"
    if "tree of thought" in text or "search" in text:
        return "test-time search"
    if "distillation" in text or "policy" in text:
        return "on-policy distillation"
    if "tool" in text or "api" in text:
        return "tool use"
    if "plan" in text:
        return "planning"
    return "unspecified"

def fetch_recent_papers(max_results=50, days_back=30):
    ensure_db()
    query = '(reasoning OR "chain of thought" OR "tree of thought" OR distillation OR planning) AND (cat:cs.AI OR cat:cs.CL OR cat:cs.LG)'
    start_date = (dt.datetime.utcnow() - dt.timedelta(days=days_back)).date().isoformat()
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending
    )

    rows = []
    for paper in search.results():
        date = paper.published.date().isoformat() if paper.published else ""
        if date < start_date:
            continue
        arxiv_id = paper.get_short_id()
        title = paper.title.strip()
        authors = ", ".join(a.name for a in paper.authors)
        abstract = paper.summary.strip()
        link = paper.entry_id
        summary = re.split(r'(?<=[.!?])\s+', abstract, 1)[0][:400]
        category = guess_category(title + " " + abstract)
        keywords = ", ".join(sorted(set(re.findall(r"[a-zA-Z]{4,}", abstract.lower())))[:15])
        rows.append((arxiv_id, title, authors, date, abstract, link, summary, category, keywords, ""))

    insert_rows(rows)
    print(f"Inserted {len(rows)} papers since {start_date}")

if __name__ == "__main__":
    fetch_recent_papers(max_results=80, days_back=45)