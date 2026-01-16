# tools/score_papers.py
import os, sqlite3, datetime, re, json, argparse
from llm_summary import call_llm
from config import DB_PATH, SCORE_BATCH_SIZE, SCORE_RANGES, SUMMARY_TRUNCATE_LENGTH, MIN_REASONING_LENGTH

SCORING_PROMPT = """
Score this AI research paper on a 0-7 scale.

**SCORING RUBRIC** (total = sum of all):

NOVELTY (0-3):
- 0: Rehash of existing work
- 1: Incremental improvement or standard application
- 2: New method or meaningful architectural change
- 3: Paradigm shift or fundamentally new approach

UTILITY (0-1):
- 0: Toy problem or narrow niche
- 1: Real bottleneck or practical use case

RESULTS (0-2):
- 0: Weak baselines or marginal gains
- 1: Solid results, method works as claimed
- 2: SOTA on major benchmarks or big efficiency win

ACCESS (0-1):
- 0: No code/models/data released
- 1: Open artifacts available

**OUTPUT**: JSON only, no other text.
{{
  "novelty": <0-3>,
  "utility": <0-1>,
  "results": <0-2>,
  "access": <0-1>,
  "reasoning": "<2 sentences: what's good and what's lacking>"
}}

**REASONING RULES**:
- Start with the key strength or weakness, not "This paper..."
- Be specific: cite benchmarks, methods, or gaps
- No fluff words: "novel", "promising", "interesting"

**CALIBRATION**: Use the full 0-7 range. A 2 is weak, 4 is solid, 6 is exceptional. Don't default to middle scores - commit to your assessment.

---
Title: {title}

TLDR: {tldr}

Summary:
{summary_md}
""".strip()


def ensure_columns(conn: sqlite3.Connection) -> None:
    cur = conn.execute("PRAGMA table_info(papers)")
    columns = {row[1] for row in cur.fetchall()}
    to_add = []
    if "raw_excitement_score" not in columns:
        to_add.append("ALTER TABLE papers ADD COLUMN raw_excitement_score INTEGER DEFAULT 0")
    if "excitement_score" not in columns:
        to_add.append("ALTER TABLE papers ADD COLUMN excitement_score INTEGER DEFAULT 0")
    if "excitement_tier" not in columns:
        to_add.append("ALTER TABLE papers ADD COLUMN excitement_tier TEXT")
    if "excitement_reasoning" not in columns:
        to_add.append("ALTER TABLE papers ADD COLUMN excitement_reasoning TEXT")
    if "score_breakdown" not in columns:
        to_add.append("ALTER TABLE papers ADD COLUMN score_breakdown TEXT")
    if "last_scored_at" not in columns:
        to_add.append("ALTER TABLE papers ADD COLUMN last_scored_at TEXT")
    for sql in to_add:
        conn.execute(sql)
    if to_add:
        conn.commit()
        print("✓ Added excitement_* columns to papers")

    # helpful index for filtering/sorting
    conn.execute("CREATE INDEX IF NOT EXISTS idx_papers_ex_score ON papers(excitement_score)")
    conn.commit()


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Score papers with an excitement metric (Tier S-D).")
    ap.add_argument("--force", action="store_true",
                    help="Rescore even if a score already exists.")
    ap.add_argument("--limit", type=int, default=SCORE_BATCH_SIZE,
                    help=f"Max papers to score this run (default: {SCORE_BATCH_SIZE}).")
    ap.add_argument("ids", nargs="*", type=int,
                    help="Optional paper IDs to score explicitly.")
    return ap.parse_args()


def select_rows(conn: sqlite3.Connection, ids, force: bool, limit: int):
    select_clause = """
        SELECT id,
               title,
               COALESCE(tldr,'') AS tldr,
               COALESCE(summary_md,'') AS summary_md,
               reasoning_category
        FROM papers
    """
    if ids:
        placeholders = ",".join(["?"] * len(ids))
        # If not forcing, skip already-scored among requested IDs
        filter_clause = "" if force else "AND COALESCE(excitement_score,0)=0"
        cur = conn.execute(f"""
            {select_clause}
            WHERE id IN ({placeholders})
              AND summary_md IS NOT NULL AND summary_md <> ''
              {filter_clause}
            ORDER BY id DESC
        """, ids)
    else:
        if force:
            cur = conn.execute(f"""
                {select_clause}
                WHERE summary_md IS NOT NULL AND summary_md <> ''
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))
        else:
            cur = conn.execute(f"""
                {select_clause}
                WHERE summary_md IS NOT NULL AND summary_md <> ''
                  AND COALESCE(excitement_score,0)=0
                ORDER BY id DESC
                LIMIT ?
            """, (limit,))
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def build_prompt(row: dict) -> str:
    # Cap inputs to keep cost and drift low
    tl = (row.get("tldr") or "").strip()
    sm = (row.get("summary_md") or "").strip()
    sm = sm[:SUMMARY_TRUNCATE_LENGTH]
    return SCORING_PROMPT.format(title=row["title"], tldr=tl, summary_md=sm)


def extract_first_json_object(text: str) -> str:
    """Extract the first balanced JSON object from text using bracket matching."""
    start = text.find('{')
    if start == -1:
        raise ValueError("No JSON object found in response")

    depth = 0
    in_string = False
    escape_next = False

    for i, char in enumerate(text[start:], start):
        if escape_next:
            escape_next = False
            continue
        if char == '\\' and in_string:
            escape_next = True
            continue
        if char == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                return text[start:i+1]

    raise ValueError("No complete JSON object found (unbalanced braces)")


def parse_score_response(text: str) -> dict:
    # Strip common markdown fences
    s = text.strip().replace("```json", "```")
    if s.startswith("```") and s.endswith("```"):
        s = s[3:-3].strip()

    # Try direct JSON
    try:
        data = json.loads(s)
    except Exception:
        # Fallback: extract first complete JSON object using bracket matching
        json_str = extract_first_json_object(text)
        data = json.loads(json_str)

    # Normalize field name (support both old and new)
    if "accessibility" in data and "access" not in data:
        data["access"] = data["accessibility"]

    # Validate ranges & fields
    def in_range(v, lo, hi): return isinstance(v, int) and lo <= v <= hi
    for field, (lo, hi) in SCORE_RANGES.items():
        if not in_range(data.get(field), lo, hi):
            raise ValueError(f"{field} out of range: {data.get(field)}")
    if not isinstance(data.get("reasoning"), str) or len(data["reasoning"].strip()) < MIN_REASONING_LENGTH:
        raise ValueError("missing/short reasoning")
    return data


def calculate_tier(score: int) -> str:
    """
    Maps the 0-7 score to a Tier.
    S-tier (7): Groundbreaking contributions
    A-tier (5-6): Strong, significant work
    B-tier (4): Solid but limited impact
    C-tier (2-3): Methodologically sound but narrow
    D-tier (<=1): Flawed or inconclusive
    """
    if score >= 7:
        return "S"
    elif score >= 5:
        return "A"
    elif score == 4:
        return "B"
    elif score >= 2:
        return "C"
    else:
        return "D"


def save_score(conn: sqlite3.Connection, pid: int, score: dict, raw_score: int, tier: str) -> None:
    now = datetime.datetime.utcnow().isoformat()
    breakdown = f"Novelty:{score['novelty']}, Utility:{score['utility']}, Results:{score['results']}, Access:{score['access']}"
    conn.execute("""
        UPDATE papers
        SET raw_excitement_score = ?,
            excitement_score = ?,
            excitement_tier = ?,
            excitement_reasoning = ?,
            score_breakdown = ?,
            last_scored_at = ?
        WHERE id = ?
    """, (raw_score, raw_score, tier, score["reasoning"], breakdown, now, pid))
    conn.commit()


def main():
    args = parse_args()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_columns(conn)

    rows = select_rows(conn, args.ids, args.force, args.limit)
    if not rows:
        if args.ids and not args.force:
            print("Nothing to do. These IDs may already be scored. Use --force to rescore.")
        else:
            print("No papers need scoring. ✅")
        conn.close()
        return

    print(f"Scoring {len(rows)} paper(s){' with --force' if args.force else ''}...\n")

    for i, row in enumerate(rows, 1):
        pid = row["id"]
        prompt = build_prompt(row)
        try:
            resp = call_llm(prompt)  # call_llm() should already be low-temp for determinism
            data = parse_score_response(resp["text"])
            
            # Enforce deterministic scoring: Sum of parts
            calculated_score = data['novelty'] + data['utility'] + data['results'] + data['access']
            tier = calculate_tier(calculated_score)

            print(f"✓ {pid}: {row['title'][:60]}...")
            print(f"   Score: {calculated_score}/7 -> Tier {tier} | N:{data['novelty']} U:{data['utility']} R:{data['results']} A:{data['access']}")
            print(f"   Why: {data['reasoning'][:120]}...\n")

            save_score(conn, pid, data, calculated_score, tier)

        except Exception as e:
            print(f"× {pid}: {type(e).__name__}: {e}\n")

    conn.close()


if __name__ == "__main__":
    main()
