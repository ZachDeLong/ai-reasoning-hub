import sys, sqlite3, os
from rich.console import Console
from rich.table import Table
from rich.text import Text

console = Console()
DB = os.path.join(os.path.dirname(__file__), "..", "data", "papers.db")

q = " ".join(sys.argv[1:]).strip()
if not q:
    console.print("[bold red]Usage:[/] python backend/search.py <keywords>")
    raise SystemExit(1)

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("""
SELECT title, reasoning_category, date, arxiv_link
FROM papers
WHERE (title LIKE ? OR abstract LIKE ? OR keywords LIKE ?)
ORDER BY date DESC
LIMIT 20
""", (f"%{q}%", f"%{q}%", f"%{q}%"))
rows = cur.fetchall()
conn.close()

if not rows:
    console.print(f"[yellow]No results found for '{q}'.[/]")
    raise SystemExit()

# create a styled table
table = Table(title=f"Search Results for '{q}'", show_lines=True)
table.add_column("#", style="cyan", width=3)
table.add_column("Title", style="bold white")
table.add_column("Category", style="magenta")
table.add_column("Date", style="green")
table.add_column("Link", style="blue underline")

for i, r in enumerate(rows, 1):
    title = Text(r["title"], style="bold white")
    table.add_row(str(i), title, r["reasoning_category"] or "-", r["date"], r["arxiv_link"])

console.print(table)
