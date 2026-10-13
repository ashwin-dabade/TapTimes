"""Check that every piece of the setup works, one at a time.

Usage:
    python ingest/check_setup.py           # everything, incl. one small LLM call
    python ingest/check_setup.py --no-llm  # skip the LLM call

Reads ingest/.env. Add SUPABASE_ANON_KEY there to also verify that Row Level
Security blocks anonymous access the way the frontend relies on.
Read-only except for the single LLM request.
"""

import os
import sys

import httpx

from ingest import load_dotenv

results = []


def check(name):
    def wrap(fn):
        try:
            detail = fn()
            results.append((True, name, detail or ""))
        except Exception as e:  # noqa: BLE001 - report any failure as FAIL
            results.append((False, name, str(e)[:300]))
        return fn

    return wrap


def rest(key: str) -> httpx.Client:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    return httpx.Client(
        base_url=f"{url}/rest/v1", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=30
    )


def main() -> int:
    load_dotenv()
    skip_llm = "--no-llm" in sys.argv

    @check("Environment variables")
    def _():
        required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GUARDIAN_API_KEY"]
        provider = os.getenv("LLM_PROVIDER", "gemini").lower()
        required.append("GROQ_API_KEY" if provider == "groq" else "GEMINI_API_KEY")
        missing = [k for k in required if not os.getenv(k)]
        if missing:
            raise RuntimeError(f"missing: {', '.join(missing)}")
        return f"LLM_PROVIDER={provider}"

    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    @check("Supabase reachable (service-role key)")
    def _():
        with rest(service_key) as c:
            r = c.get("/articles", params={"select": "id", "limit": 1})
            if r.status_code in (401, 403):
                raise RuntimeError(f"{r.status_code}: key rejected. Is it the service_role key? {r.text}")
            r.raise_for_status()
            total = c.get(
                "/articles", params={"select": "id"}, headers={"Prefer": "count=exact", "Range": "0-0"}
            )
            return f"articles in table: {total.headers.get('content-range', '?').split('/')[-1]}"

    @check("Migration applied (new columns + tables)")
    def _():
        with rest(service_key) as c:
            for table, cols in [
                ("articles", "external_id,section,summary,published_at"),
                ("typing_tests", "article_id,corrected_errors,uncorrected_errors"),
                ("user_article_views", "user_id,article_id"),
                ("users", "id,username,email"),
            ]:
                r = c.get(f"/{table}", params={"select": cols, "limit": 1})
                if r.status_code != 200:
                    raise RuntimeError(
                        f"{table}: {r.text} -> run supabase/migrations/001_serverless_schema.sql"
                    )

    @check("Function get_next_article()")
    def _():
        with rest(service_key) as c:
            r = c.post("/rpc/get_next_article", json={})
            if r.status_code != 200:
                raise RuntimeError(r.text)
            rows = r.json()
            return (
                f"returned: {rows[0]['title']!r}"
                if rows
                else "works, but no unexpired articles (run seed.py)"
            )

    @check("Function username_available()")
    def _():
        with rest(service_key) as c:
            r = c.post("/rpc/username_available", json={"name": "__nobody_has_this__"})
            if r.status_code != 200 or r.json() is not True:
                raise RuntimeError(r.text)

    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if anon_key:

        @check("RLS: anonymous can read articles")
        def _():
            with rest(anon_key) as c:
                r = c.post("/rpc/get_next_article", json={})
                r.raise_for_status()

        @check("RLS: anonymous cannot read users or tests")
        def _():
            with rest(anon_key) as c:
                for table in ("users", "typing_tests", "user_article_views"):
                    r = c.get(f"/{table}", params={"select": "*", "limit": 1})
                    if r.status_code == 200 and r.json():
                        raise RuntimeError(f"{table} rows are visible to anonymous users!")

        @check("RLS: anonymous cannot write articles")
        def _():
            with rest(anon_key) as c:
                r = c.post("/articles", json={"title": "x", "source": "x", "url": "x", "words": ["x"]})
                if r.status_code < 400:
                    raise RuntimeError("anonymous insert into articles succeeded!")
    else:
        results.append((None, "RLS checks", "skipped: add SUPABASE_ANON_KEY to ingest/.env to run them"))

    @check("Guardian API")
    def _():
        import sources

        articles = sources.fetch_guardian(page_size=5)
        return (
            f"{len(articles)} usable articles, e.g. {articles[0].title!r}"
            if articles
            else "0 usable articles"
        )

    if skip_llm:
        results.append((None, "LLM summary", "skipped (--no-llm)"))
    else:

        @check("LLM summary")
        def _():
            import summarize

            text = summarize.summarize(
                "Test",
                "The town council voted on Tuesday to keep the public pool open for two more weeks this "
                "summer because of the unusually warm weather. Lifeguards agreed to extra shifts.",
                min_words=15,
                max_words=30,
            )
            model = summarize.GEMINI_MODEL if summarize.PROVIDER == "gemini" else summarize.GROQ_MODEL
            return f"{model}: {text!r}"

    print()
    for ok, name, detail in results:
        mark = "SKIP" if ok is None else ("PASS" if ok else "FAIL")
        print(f"[{mark}] {name}" + (f"\n       {detail}" if detail else ""))
    failed = sum(1 for ok, *_ in results if ok is False)
    print(f"\n{'All checks passed' if not failed else f'{failed} check(s) failed'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
