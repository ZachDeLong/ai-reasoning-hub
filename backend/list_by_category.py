import sys, sqlite3, os

show_full = "--full" in sys.argv

cat = " ".join([arg for arg in sys.argv[1:] if arg != "--full"]).strip() or "unspecified"

DB = os.path.join(os.path.dirname(__file__), "..", "data", "papers.db")

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("""
SELECT title, date, arxiv_link,
       COALESCE(tldr,'')       AS tldr,
       COALESCE(summary_md,'') AS summary_md
FROM papers
WHERE reasoning_category = ?
ORDER BY date DESC
LIMIT 25
""", (cat,))

rows = cur.fetchall()
conn.close()

if not rows:
    print(f"No papers found for category '{cat}'. Try 'unspecified' or check spelling.")
else:
    print(f"\n== {cat.upper()} ==")
    for i, r in enumerate(rows, 1):
        print(f"{i}. {r['title']} ({r['date']})")
        if r['tldr']:
            print(f"   TL;DR: {r['tldr'][:200]}{'...' if len(r['tldr'])>200 else ''}")
        print(f"   {r['arxiv_link']}\n")

        if show_full and r['summary_md']:
            print("   Summary:")
            body = r['summary_md']
            preview = body[:1200]
            print("   " + preview.replace("\n", "\n   "))
            if len(body) > 1200:
                print("   ...\n")
