import argparse
import datetime
import os
import sqlite3

from llm_summary import call_llm, triage_paper
from config import DB_PATH, SUMMARY_BATCH_SIZE

PROMPT_TEMPLATE = """
You are a technical reviewer writing for ML engineers who want substance, not fluff.

**STRICT RULES**:
- NO filler phrases: "novel approach", "promising results", "state-of-the-art", "significant improvement"
- NO vague claims without numbers
- Be direct and specific

**OUTPUT FORMAT** (use exact headers):

# TLDR
<One sentence (max 25 words) capturing the core contribution. Be specific about WHAT and HOW.>

# Core Idea
<2-3 sentences: What's the key insight or mechanism? Why does it work?>

# Method
<2-4 bullets: Technical approach with specific details (architectures, algorithms, data). Each bullet must be concrete.>

# Results
<2-4 bullets: Quantitative results only. Every bullet needs a number. Format: "X% on [benchmark], beating [baseline] by Y points">

# Takeaway
<1-2 sentences: Should practitioners care? What's the practical implication?>

---

Title: {title}
Authors: {authors}
URL: {url}

Abstract:
{abstract}
""".strip()


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Generate summaries and TLDRs for papers.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-summarize even if a summary or TLDR already exists.",
    )
    parser.add_argument(
        "ids",
        nargs="*",
        type=int,
        help="Specific paper IDs to summarize.",
    )
    return parser.parse_args(argv)


def fetch_papers(conn, ids=None, force=False):
    base_query = """
        SELECT id, title, authors, abstract, arxiv_link AS url,
               COALESCE(notes, '') AS notes,
               COALESCE(summary_md, '') AS summary_md,
               COALESCE(tldr, '') AS tldr
        FROM papers
    """

    if ids:
        placeholders = ",".join("?" for _ in ids)
        cur = conn.execute(base_query + f" WHERE id IN ({placeholders})", ids)
    elif force:
        cur = conn.execute(base_query + " ORDER BY id DESC LIMIT ?", (SUMMARY_BATCH_SIZE,))
    else:
        cur = conn.execute(
            base_query
            + """
            WHERE (summary_md IS NULL OR TRIM(summary_md) = '')
               OR (tldr IS NULL OR TRIM(tldr) = '')
            ORDER BY id DESC
            LIMIT ?
            """,
            (SUMMARY_BATCH_SIZE,),
        )

    cols = [c[0] for c in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    if ids:
        lookup = {row["id"]: row for row in rows}
        rows = [lookup[i] for i in ids if i in lookup]
        missing = [str(i) for i in ids if i not in lookup]
        if missing:
            print(f"Missing paper ID(s): {', '.join(missing)}")

    return rows


def save_summary(conn, pid, summary_md, tldr, model, tokens):
    now = datetime.datetime.utcnow().isoformat()
    conn.execute(
        """
        UPDATE papers
        SET summary_md = ?,
            tldr = ?,
            model_used = ?,
            summary_tokens = ?,
            last_summarized_at = ?
        WHERE id = ?
        """,
        (summary_md, tldr, model, tokens, now, pid),
    )
    conn.commit()


def extract_tldr(markdown: str) -> str:
    """Extract TLDR from the dedicated # TLDR section."""
    lines = [l.strip() for l in markdown.splitlines()]
    for i, l in enumerate(lines):
        # Look for # TLDR header
        if l.lower().replace(" ", "") in ["#tldr", "#tl;dr"]:
            # Get next non-empty, non-header line
            for j in range(i + 1, min(i + 5, len(lines))):
                if lines[j] and not lines[j].startswith("#"):
                    # Clean up any leading/trailing quotes or formatting
                    tldr = lines[j].strip().strip('"').strip("'")
                    return tldr[:300]

    # Fallback: look for "Core Idea" section
    for i, l in enumerate(lines):
        if "core idea" in l.lower():
            for j in range(i + 1, min(i + 5, len(lines))):
                if lines[j] and not lines[j].startswith("#"):
                    return lines[j][:200]

    # Last resort: first non-header line
    for l in lines:
        if l and not l.startswith("#"):
            return l[:200]
    return ""


def main(argv=None):
    args = parse_args(argv)
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = fetch_papers(conn, ids=args.ids, force=args.force)

        if not rows:
            if args.ids:
                print("No matching papers to summarize.")
            else:
                print("No papers need summaries. ✅")
            return

        print(f"Processing {len(rows)} paper(s) with 2-stage cascade...\n")

        triaged_count = 0
        skipped_count = 0
        summarized_count = 0
        total_triage_tokens = 0

        for row in rows:
            pid = row["id"]
            title = row["title"]
            abstract = row["abstract"]

            existing_summary = row.get("summary_md", "")
            has_real_summary = existing_summary and "[Skipped" not in existing_summary
            if has_real_summary and not args.force:
                print(f"⏭️  {pid}: Already summarized, skipping")
                continue

            print(f"🔍 Triaging {pid}: {title[:60]}...")
            try:
                triage_result = triage_paper(title, abstract)
                triaged_count += 1
                total_triage_tokens += triage_result.get("tokens", 0) or 0

                if not triage_result["relevant"]:
                    print(f"   ⏭️  Skipped - Not relevant: {triage_result['reason']}")
                    skipped_count += 1
                    conn.execute(
                        "UPDATE papers SET summary_md = ?, tldr = ? WHERE id = ?",
                        ("[Skipped - Not relevant to reasoning]", triage_result["reason"], pid),
                    )
                    conn.commit()
                    continue

                print(f"   ✓ Relevant - {triage_result['reason'][:80]}")
            except Exception as e:
                print(f"   ⚠️  Triage failed: {e}, proceeding with full summary anyway")

            prompt = PROMPT_TEMPLATE.format(**row)
            try:
                resp = call_llm(prompt)
                md = (resp["text"] or "").strip()
                violations = [p for p in ["novel approach", "promising results", "significant improvement"] if p in md.lower()]
                if violations:
                    print(f"⚠️  Paper {row['id']} boilerplate: {violations}")
                tldr = extract_tldr(md)
                save_summary(conn, pid, md, tldr, resp.get("model"), resp.get("tokens"))
                summarized_count += 1
                print(f"   ✅ Summarized ({len(md)} chars)\n")
            except Exception as e:
                print(f"   ❌ Summary failed: {e}\n")

        print("\n" + "=" * 60)
        print("📊 Pipeline Summary:")
        print(f"   Papers triaged: {triaged_count}")
        print(f"   Skipped (not relevant): {skipped_count}")
        print(f"   Summarized: {summarized_count}")
        if triaged_count > 0:
            pass_rate = summarized_count / triaged_count * 100
            print(f"   Pass rate: {pass_rate:.1f}%")
        print(f"   Triage tokens used: {total_triage_tokens}")
        if summarized_count > 0:
            triage_cost = total_triage_tokens / 1_000_000 * 0.15  # gpt-4.1-mini fallback
            summary_cost = summarized_count * 0.04  # rough estimate
            total_cost = triage_cost + summary_cost
            print(f"   Estimated cost: ${total_cost:.2f}")
        print("=" * 60)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
