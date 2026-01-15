import os
import sqlite3
import logging
from datetime import datetime
import requests

from config import DB_PATH, REQUEST_TIMEOUT

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_huggingface_papers():
    """
    Fetch trending papers from HuggingFace Daily Papers.
    Returns last 7 days of papers (usually ~30-50 papers).
    """
    papers = []
    try:
        url = "https://huggingface.co/api/daily_papers"
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except requests.Timeout:
        logger.error("HuggingFace API request timed out")
        return papers
    except requests.RequestException as exc:
        logger.error(f"HuggingFace fetch failed: {exc}")
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

    logger.info(f"Found {len(papers)} papers from HuggingFace Daily Papers")
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
    except sqlite3.Error as exc:
        logger.warning(f"Failed to add paper: {exc}")
        return False


def main():
    logger.info("=" * 60)
    logger.info("STARTING: Collecting papers from HuggingFace...")
    logger.info("=" * 60)

    papers = get_huggingface_papers()

    if not papers:
        logger.warning("No papers found. Exiting.")
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
            logger.debug(f"Skipped duplicate: {paper['title'][:40]}...")
            continue

        if add_paper_to_db(conn, paper):
            new_count += 1
            logger.info(f"Added: {paper['title'][:60]}...")

    conn.close()

    logger.info("=" * 60)
    logger.info("Collection complete!")
    logger.info(f"New papers added: {new_count}")
    logger.info(f"Duplicates skipped: {skipped_count}")
    logger.info("Next: Run 'python tools/summarize_papers.py' to process new papers.")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()


