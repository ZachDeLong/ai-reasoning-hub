import argparse
import datetime
import os
import sqlite3

from llm_summary import call_llm, triage_paper

DB_PATH = os.getenv("PROJECTS_DB", "data/papers.db")
BATCH_LIMIT = int(os.getenv("SUMMARY_BATCH", "10"))

PROMPT_TEMPLATE = """
You are a **Critical Technical Reviewer** for an AI research lab. Your audience consists of ML engineers and researchers who want deep technical insights, not marketing fluff.

**GOAL**: Deconstruct this paper into its core technical contributions.

**NEGATIVE CONSTRAINTS (STRICTLY ENFORCED)**:
- NO generic praise ("promising results", "novel approach", "state-of-the-art").
- NO vague summaries ("The authors propose a method to improve...").
- NO marketing speak ("revolutionizes", "game-changer").
- If a bullet point does not contain a specific number, metric, or concrete architectural detail, DELETE IT.

**OUTPUT FORMAT (Markdown)**:

# The Big Idea
<1 punchy sentence that captures the "aha!" moment. What is the core innovation?>

# Insight
<2-3 sentences explaining the *technical mechanism* that makes this work. How does it actually solve the problem? Be specific about architecture/loss/data.>

## Problem
<1 bullet: What specific limitation or gap is being addressed?>

## Method
<2-3 bullets: The technical approach. Mention specific architectures (e.g., Transformer, Mamba), algorithms (e.g., DPO, PPO), or data scales.>

## Results
<3-5 bullets. EVERY bullet must cite a specific number, percentage, or comparison from the paper. Example: "Achieves 85.2% on GSM8K, surpassing Llama-2-70B (83.1%).">

## Limitations
<1-3 bullets: What does it *fail* to do? What are the constraints? (e.g., "Requires 8x H100s", "Fails on long-context >32k")>

## Why It Matters
<2-3 bullets: Practical implications for engineers. Can we use this? Does it change how we train models?>

## Notable Quotes
<2-3 verbatim quotes from the paper that capture key insights or philosophy.>

---

Title: {title}
Authors: {authors}
ArXiv ID/URL: {url}

Abstract:
{abstract}

Optional context:
{notes}
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
        cur = conn.execute(base_query + " ORDER BY id DESC LIMIT ?", (BATCH_LIMIT,))
    else:
        cur = conn.execute(
            base_query
            + """
            WHERE (summary_md IS NULL OR TRIM(summary_md) = '')
               OR (tldr IS NULL OR TRIM(tldr) = '')
            ORDER BY id DESC
            LIMIT ?
            """,
            (BATCH_LIMIT,),
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
    lines = [l.strip() for l in markdown.splitlines()]
    for i, l in enumerate(lines):
        low = l.lower().replace(";", "")
        # Look for the new header format
        if "the big idea" in low or "tldr" in low:
            # next non-empty line is the TLDR
            for j in range(i + 1, min(i + 6, len(lines))):
                if lines[j] and not lines[j].startswith("#"):
                    return lines[j]
    # fallback: first non-empty line that isn't a header
    for l in lines:
        if l and not l.startswith("#"):
            return l[:280]
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
