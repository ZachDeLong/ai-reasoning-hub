# tools/score_papers.py
import os, sqlite3, datetime, time, random, re, json, argparse, math
from llm_summary import call_llm

DB_PATH = os.getenv("PROJECTS_DB", "data/papers.db")
DEFAULT_BATCH = int(os.getenv("SCORE_BATCH", "10"))
SCORE_RESCALE_ENABLED = os.getenv("SCORE_RESCALE", "0").strip().lower() in {"1", "true", "yes", "on"}
SCORE_RESCALE_MODE = os.getenv("SCORE_RESCALE_MODE", "global").strip().lower()


def _env_float(name: str, default: float) -> float:
    val = os.getenv(name)
    if val is None:
        return float(default)
    try:
        return float(val)
    except ValueError:
        return float(default)


SCORE_TARGET_MEAN = _env_float("SCORE_TARGET_MEAN", 6.2)
SCORE_TARGET_STD = _env_float("SCORE_TARGET_STD", 1.6)
if SCORE_TARGET_STD <= 0:
    SCORE_TARGET_STD = 1.0
if SCORE_RESCALE_MODE not in {"global", "per_category"}:
    SCORE_RESCALE_MODE = "global"

SCORING_PROMPT = """
You are a critical reviewer evaluating AI research papers.

Rate this paper on a scale of 1-10 based on:
- Novelty (3 pts): How new/surprising is the approach or finding?
- Impact (4 pts): Could this significantly change how people build or think about AI?
- Results (2 pts): Are the improvements substantial and well-demonstrated?
- Accessibility (1 pt): Can others easily build on or reproduce this work?

Output ONLY a JSON object in this exact format:
{{
  "score": <integer 1-10>,
  "reasoning": "<2-3 sentences explaining the score>",
  "novelty": <integer 1-3>,
  "impact": <integer 1-4>,
  "results": <integer 1-2>,
  "accessibility": <integer 0-1>
}}

**NEGATIVE CONSTRAINTS (STRICTLY ENFORCED)**:
- DO NOT start with "The paper introduces...", "This work presents...", or "___ proposes a novel...".
- DO NOT use the phrase "novel approach" or "fresh perspective".
- DO NOT start sentences with "By [verb]ing..." (e.g., "By leveraging...", "By introducing...").
- **VARIETY REQUIRED**: Use diverse sentence structures. Mix it up.
    - "This work achieves X..."
    - "Using Y, the authors demonstrate..."
    - "The key contribution is..."
    - "Ideally, this would..."
- Be direct. Start immediately with the critique or the specific value proposition.

Calibrate distribution realistically:
- 1–3 ≈ 40–50% (incremental or niche)
- 4–6 ≈ 40–50% (solid but non-breakthrough)
- 7–8 ≈ 5–10% (important contribution)
- 9–10 ≈ <1% (breakthrough; use only with clear evidence)
If uncertain, choose the lower score.

---
Title: {title}

TLDR:
{tldr}

Full Summary (truncated):
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
    ap = argparse.ArgumentParser(description="Score papers with an excitement metric (1–10).")
    ap.add_argument("--force", action="store_true",
                    help="Rescore even if a score already exists.")
    ap.add_argument("--limit", type=int, default=DEFAULT_BATCH,
                    help=f"Max papers to score this run (default: {DEFAULT_BATCH}).")
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
    sm = sm[:1500]  # ~1–2k chars is plenty for scoring
    return SCORING_PROMPT.format(title=row["title"], tldr=tl, summary_md=sm)


def parse_score_response(text: str) -> dict:
    # Strip common markdown fences
    s = text.strip().replace("```json", "```")
    if s.startswith("```") and s.endswith("```"):
        s = s[3:-3].strip()

    # Try direct JSON
    try:
        data = json.loads(s)
    except Exception:
        # Fallback: first {...} block anywhere
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise ValueError("No JSON object found in response")
        data = json.loads(m.group(0))

    # Validate ranges & fields
    def in_range(v, lo, hi): return isinstance(v, int) and lo <= v <= hi
    if not in_range(data.get("score"), 1, 10):
        raise ValueError(f"score out of range: {data.get('score')}")
    if not in_range(data.get("novelty"), 1, 3):
        raise ValueError(f"novelty out of range: {data.get('novelty')}")
    if not in_range(data.get("impact"), 1, 4):
        raise ValueError(f"impact out of range: {data.get('impact')}")
    if not in_range(data.get("results"), 1, 2):
        raise ValueError(f"results out of range: {data.get('results')}")
    if not in_range(data.get("accessibility"), 0, 1):
        raise ValueError(f"accessibility out of range: {data.get('accessibility')}")
    if not isinstance(data.get("reasoning"), str) or len(data["reasoning"].strip()) < 8:
        raise ValueError("missing/short reasoning")
    return data


def _category_key(value):
    if value is None:
        return None
    value = value.strip()
    return value or None


def _mean_std(values):
    mean = sum(values) / len(values)
    if len(values) == 1:
        return mean, 1.0
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std = math.sqrt(variance)
    if std < 1e-6:
        std = 1.0
    return mean, std


def apply_rescaling(batch_results):
    if not batch_results:
        return

    if not SCORE_RESCALE_ENABLED:
        for item in batch_results:
            item["rescaled_score"] = item["raw_score"]
        return

    raw_scores = [item["raw_score"] for item in batch_results]
    global_stats = _mean_std(raw_scores)

    category_stats = {}
    if SCORE_RESCALE_MODE == "per_category":
        category_scores = {}
        for item in batch_results:
            key = _category_key(item.get("reasoning_category"))
            category_scores.setdefault(key, []).append(item["raw_score"])
        category_stats = {
            key: _mean_std(vals)
            for key, vals in category_scores.items()
            if len(vals) >= 3
        }

    for item in batch_results:
        stats = global_stats
        if SCORE_RESCALE_MODE == "per_category":
            key = _category_key(item.get("reasoning_category"))
            if key in category_stats:
                stats = category_stats[key]
        mean, std = stats
        z = 0.0 if std < 1e-6 else (item["raw_score"] - mean) / std
        scaled = SCORE_TARGET_MEAN + z * SCORE_TARGET_STD
        clamped = min(10, max(1, scaled))
        item["rescaled_score"] = int(round(clamped))


def save_score(conn: sqlite3.Connection, pid: int, score: dict, raw_score: int, final_score: int) -> None:
    now = datetime.datetime.utcnow().isoformat()
    breakdown = f"Novelty:{score['novelty']}, Impact:{score['impact']}, Results:{score['results']}, Access:{score['accessibility']}"
    conn.execute("""
        UPDATE papers
        SET raw_excitement_score = ?,
            excitement_score = ?,
            excitement_reasoning = ?,
            score_breakdown = ?,
            last_scored_at = ?
        WHERE id = ?
    """, (raw_score, final_score, score["reasoning"], breakdown, now, pid))
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

    scored_results = []
    for i, row in enumerate(rows, 1):
        pid = row["id"]
        prompt = build_prompt(row)
        try:
            resp = call_llm(prompt)  # call_llm() should already be low-temp for determinism
            data = parse_score_response(resp["text"])
            # Enforce deterministic scoring: Sum of parts
            # This overrides the LLM's hallucinated "score" field
            calculated_score = data['novelty'] + data['impact'] + data['results'] + data['accessibility']
            
            print(f"✓ {pid}: {row['title'][:60]}...")
            print(f"   Score: {calculated_score}/10 (Calculated) | Breakdown: N{data['novelty']}/I{data['impact']}/R{data['results']}/A{data['accessibility']}")
            print(f"   Why: {data['reasoning'][:120]}...\n")

            scored_results.append({
                "paper_id": pid,
                "row": row,
                "data": data,
                "raw_score": calculated_score,
                "rescaled_score": calculated_score,
                "reasoning_category": row.get("reasoning_category"),
            })

        except Exception as e:
            print(f"× {pid}: {type(e).__name__}: {e}\n")

    apply_rescaling(scored_results)

    for item in scored_results:
        raw_score = item["raw_score"]
        final_score = item["rescaled_score"]
        save_score(conn, item["paper_id"], item["data"], raw_score, final_score)
        print(f"   Rescale [{item['paper_id']}]: raw = {raw_score} → rescaled = {final_score}\n")

    conn.close()


if __name__ == "__main__":
    main()
