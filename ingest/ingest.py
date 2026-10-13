"""Nightly job: fetch news, summarize with an LLM, store in Supabase.

Usage:
    python ingest/ingest.py            # normal nightly run
    python ingest/ingest.py --reset    # delete ALL articles (manual only)

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GUARDIAN_API_KEY,
     LLM_PROVIDER (gemini|groq) + GEMINI_API_KEY or GROQ_API_KEY.
Optional: ARTICLES_PER_RUN (default 10), ARTICLE_TTL_DAYS (default 7).
"""

import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import db
import sources
import summarize

ARTICLES_PER_RUN = int(os.getenv("ARTICLES_PER_RUN", "10"))
ARTICLE_TTL_DAYS = int(os.getenv("ARTICLE_TTL_DAYS", "7"))


def load_dotenv() -> None:
    """Read ingest/.env for local runs (GitHub Actions passes real env vars)."""
    env_file = Path(__file__).with_name(".env")
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def run() -> int:
    expired = db.delete_expired()
    print(f"Deleted {expired} expired articles")

    candidates = sources.fetch_all()
    print(f"Fetched {len(candidates)} candidate articles")

    # Skip what we already have *before* spending LLM rate limit on it.
    known = db.existing_external_ids(a.external_id for a in candidates)
    fresh = [a for a in candidates if a.external_id not in known][:ARTICLES_PER_RUN]
    print(f"{len(fresh)} new articles to summarize ({len(known)} already stored)")

    if not fresh:
        print("Nothing new to add")
        return 0

    expires_at = (datetime.now(UTC) + timedelta(days=ARTICLE_TTL_DAYS)).isoformat()
    rows = []
    for article in fresh:
        try:
            summary = summarize.summarize(article.title, article.body)
        except summarize.RateLimitedError as e:
            print(f"Stopping early: {e}")
            break
        except Exception as e:  # noqa: BLE001 - one bad article must not stop the run
            print(f"  Skipped {article.title!r}: {e}")
            continue
        print(f"  Summarized ({len(summary.split())} words): {article.title}")
        rows.append(
            {
                "external_id": article.external_id,
                "title": article.title,
                "source": article.source,
                "url": article.url,
                "section": article.section,
                "published_at": article.published_at,
                "summary": summary,
                "words": summary.split(),
                "expires_at": expires_at,
            }
        )

    inserted = db.insert_articles(rows)
    print(f"Inserted {inserted} articles")

    # New articles existed but none made it in: fail so the Actions run shows red.
    if inserted == 0:
        print("ERROR: no articles were inserted", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    load_dotenv()
    if "--reset" in sys.argv:
        print(f"Deleted {db.delete_all_articles()} articles")
        return 0
    return run()


if __name__ == "__main__":
    sys.exit(main())
