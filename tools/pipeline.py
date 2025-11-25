#!/usr/bin/env python3
import argparse
import os
import sys
import subprocess
import sqlite3
from datetime import datetime

# Configuration
DB_PATH = os.getenv("PROJECTS_DB", "data/papers.db")
TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))

def run_step(script_name, args=None, description=""):
    """Run a script as a subprocess."""
    print(f"\n{'='*60}")
    print(f"🚀 STEP: {description}")
    print(f"{'='*60}")
    
    cmd = [sys.executable, os.path.join(TOOLS_DIR, script_name)]
    if args:
        cmd.extend(args)
        
    print(f"DEBUG: Running command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, check=True, text=True)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running {script_name}: {e}")
        return False

def reset_database():
    """Clear the database if requested."""
    if not os.path.exists(DB_PATH):
        print("⚠️  Database does not exist, nothing to reset.")
        return

    print("\n" + "!"*60)
    print("⚠️  WARNING: DELETING DATABASE")
    print("!"*60)
    
    try:
        os.remove(DB_PATH)
        print("✅ Database deleted.")
        
        # Re-initialize by connecting (sqlite3 creates file)
        conn = sqlite3.connect(DB_PATH)
        conn.close()
        print("✅ Database re-initialized (empty).")
    except Exception as e:
        print(f"❌ Failed to reset database: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="AI Reasoning Hub Pipeline: Collect -> Summarize -> Score")
    
    parser.add_argument("--refresh", action="store_true", 
                        help="Force re-summarization and re-scoring of ALL papers (updates to new prompts).")
    parser.add_argument("--reset", action="store_true", 
                        help="DANGER: Delete the database and start fresh.")
    parser.add_argument("--days", type=int, default=7, 
                        help="Number of days to look back for collection (default: 7).")
    
    args = parser.parse_args()

    # 1. Reset DB if requested
    if args.reset:
        confirm = input("Are you sure you want to DELETE the entire database? (type 'yes' to confirm): ")
        if confirm.lower() != "yes":
            print("❌ Aborted.")
            sys.exit(1)
        reset_database()

    # 2. Collect Papers
    # Note: collect_weekly_papers.py doesn't accept args yet, but it fetches the last 7 days by default.
    # We can add arg support to it later if needed.
    if not run_step("collect_weekly_papers.py", description="Collecting Papers from HuggingFace"):
        print("❌ Pipeline stopped at Collection step.")
        sys.exit(1)

    # 3. Summarize Papers
    summary_args = []
    if args.refresh:
        summary_args.append("--force")
        # If refreshing, we might want to process ALL papers, not just the default batch.
        # summarize_papers.py uses SUMMARY_BATCH env var (default 10).
        # We should probably override this or loop, but for now let's rely on the script's logic.
        # If --force is passed without IDs, it limits to BATCH_LIMIT.
        # To refresh ALL, we might need to increase the limit.
        os.environ["SUMMARY_BATCH"] = "100" # Bump up batch size for refresh
    
    if not run_step("summarize_papers.py", args=summary_args, description="Summarizing Papers"):
        print("❌ Pipeline stopped at Summarization step.")
        sys.exit(1)

    # 4. Score Papers
    score_args = []
    if args.refresh:
        score_args.append("--force")
        os.environ["SCORE_BATCH"] = "100" # Bump up batch size for refresh

    if not run_step("score_papers.py", args=score_args, description="Scoring Papers"):
        print("❌ Pipeline stopped at Scoring step.")
        sys.exit(1)

    print("\n" + "="*60)
    print("✅ PIPELINE COMPLETE")
    print("="*60)

if __name__ == "__main__":
    main()
