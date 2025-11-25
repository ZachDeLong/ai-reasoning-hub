print("Debug: Script is starting...")

import os
import sqlite3
from datetime import datetime
import requests

print("DEBUG: Imports successful...")

DB_PATH = os.getenv("PROJECTS_DB", "data/papers.db")

def get_huggingface_papers():
    """
    Fetch trending papers from HuggingFace Daily Papers.
    Returns last 7 days of papers (usually ~30-50 papers).
    """
    papers = []
    try:
        url = "https://huggingface.co/api/daily_papers"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"❌ HuggingFace fetch failed: {exc}")
        return papers

    for item in data:
        paper = item.get("paper", {})
        arxiv_id = paper.get("id", "")
        if not arxiv_id:
            continue

        authors = paper.get("authors", [])
        author_names = ", ".join(a.get("name", "") for a in authors[:5])
        if len(authors) > 5:
            author_names += ", et al."

        papers.append(
            {
                "arxiv_id": arxiv_id,
                "title": paper.get("title", ""),
                "authors": author_names,
                "abstract": paper.get("summary", ""),
                "url": f"https://arxiv.org/abs/{arxiv_id}",
                "published": paper.get("publishedAt", ""),
            }
        )

    print(f"✓ Found {len(papers)} papers from HuggingFace Daily Papers")
    return papers


def paper_exists(conn, arxiv_id):
    """Check if paper already in database"""
    cur = conn.execute(
        "SELECT COUNT(*) FROM papers WHERE arxiv_link LIKE ?",
        (f"%{arxiv_id}%",),
    )
    return cur.fetchone()[0] > 0


def add_paper_to_db(conn, paper):
    """Insert new paper into database"""
    try:
        conn.execute(
            """
            INSERT INTO papers (
                arxiv_id,
                title,
                authors,
                date,
                abstract,
                arxiv_link,
                reasoning_category,
                keywords,
                notes,
                date_added
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                paper["arxiv_id"],
                paper["title"],
                paper["authors"],
                paper["published"],
                paper["abstract"],
                paper["url"],
                "huggingface",
                "",
                f"Auto-collected from HF on {datetime.now().strftime('%Y-%m-%d')}",
                datetime.now().isoformat(),
            ),
        )
        conn.commit()
        return True
    except Exception as exc:
        print(f"⚠️  Failed to add paper: {exc}")
        return False


def main():
    print("=" * 60, flush=True)
    print("🔍 STARTING: Collecting papers from HuggingFace...", flush=True)
    print("=" * 60, flush=True)

    papers = get_huggingface_papers()
    
    print(f"DEBUG: Received {len(papers)} papers", flush=True)
    
    if not papers:
        print("❌ No papers found. Exiting.", flush=True)
        return

    conn = sqlite3.connect(DB_PATH)
    
    # Ensure table exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS papers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            arxiv_id TEXT UNIQUE,
            title TEXT,
            authors TEXT,
            date TEXT,
            abstract TEXT,
            arxiv_link TEXT,
            reasoning_category TEXT,
            keywords TEXT,
            notes TEXT,
            summary_md TEXT,
            tldr TEXT,
            excitement_score INTEGER,
            raw_excitement_score INTEGER,
            excitement_reasoning TEXT,
            score_breakdown TEXT,
            last_scored_at TEXT,
            model_used TEXT,
            summary_tokens INTEGER,
            last_summarized_at TEXT,
            date_added TEXT
        )
    """)
    conn.commit()

    # Ensure date_added column exists
    try:
        conn.execute("ALTER TABLE papers ADD COLUMN IF NOT EXISTS date_added TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        cur = conn.execute("PRAGMA table_info(papers)")
        columns = {row[1] for row in cur.fetchall()}
        if "date_added" not in columns:
            conn.execute("ALTER TABLE papers ADD COLUMN date_added TEXT")
            conn.commit()

    new_count = 0
    skipped_count = 0

    for paper in papers:
        if paper_exists(conn, paper["arxiv_id"]):
            skipped_count += 1
            print(f"⏭  Skipped duplicate: {paper['title'][:40]}...", flush=True)
            continue

        if add_paper_to_db(conn, paper):
            new_count += 1
            print(f"✓ Added: {paper['title'][:60]}...", flush=True)

    conn.close()

    print(f"\n{'=' * 60}", flush=True)
    print("✅ Collection complete!", flush=True)
    print(f"   New papers added: {new_count}", flush=True)
    print(f"   Duplicates skipped: {skipped_count}", flush=True)
    print("\nNext: Run 'python tools/summarize_papers.py' to process new papers.", flush=True)
    print(f"{'=' * 60}", flush=True)


if __name__ == "__main__":
    print("DEBUG: Script starting...", flush=True)
    main()
    print("DEBUG: Script finished.", flush=True)


