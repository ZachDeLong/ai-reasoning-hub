import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "papers.db")
os.makedirs(os.path.join(os.path.dirname(__file__), "..", "data"), exist_ok=True)

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arxiv_id TEXT UNIQUE,
    title TEXT,
    authors TEXT,
    date TEXT,
    abstract TEXT,
    arxiv_link TEXT,
    summary TEXT,
    reasoning_category TEXT,
    keywords TEXT,
    notes TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

c.execute("CREATE INDEX IF NOT EXISTS idx_papers_date ON papers(date)")
c.execute("CREATE INDEX IF NOT EXISTS idx_papers_category ON papers(reasoning_category)")

# Additional performance indexes
c.execute("CREATE INDEX IF NOT EXISTS idx_papers_date_desc ON papers(date DESC)")
c.execute("CREATE INDEX IF NOT EXISTS idx_papers_authors ON papers(authors)")
c.execute("CREATE INDEX IF NOT EXISTS idx_papers_scored_date ON papers(excitement_score DESC, date DESC)")
c.execute("CREATE INDEX IF NOT EXISTS idx_papers_arxiv_id ON papers(arxiv_id)")

conn.commit()
conn.close()
print("Database initialized at", DB_PATH)