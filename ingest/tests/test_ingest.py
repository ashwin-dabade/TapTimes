import pytest

import db
import ingest
import seed
import sources
import summarize


def article(n: int) -> sources.RawArticle:
    return sources.RawArticle(
        external_id=f"guardian:{n}",
        title=f"Title {n}",
        source="The Guardian",
        url=f"https://x/{n}",
        section="World",
        published_at=None,
        body="body " * 200,
    )


@pytest.fixture
def fake_db(monkeypatch):
    """In-memory stand-in for the Supabase calls."""
    state = {"existing": set(), "inserted": []}
    monkeypatch.setattr(db, "delete_expired", lambda: 0)
    monkeypatch.setattr(db, "existing_external_ids", lambda ids: state["existing"] & set(ids))

    def insert(rows):
        state["inserted"].extend(rows)
        return len(rows)

    monkeypatch.setattr(db, "insert_articles", insert)
    return state


@pytest.fixture
def llm_calls(monkeypatch):
    calls = []

    def fake_summarize(title, body):
        calls.append(title)
        return f"Summary of {title}."

    monkeypatch.setattr(summarize, "summarize", fake_summarize)
    return calls


def test_inserts_new_articles(monkeypatch, fake_db, llm_calls):
    monkeypatch.setattr(sources, "fetch_all", lambda: [article(1), article(2)])

    assert ingest.run() == 0
    assert [r["external_id"] for r in fake_db["inserted"]] == ["guardian:1", "guardian:2"]
    row = fake_db["inserted"][0]
    assert row["summary"] == "Summary of Title 1."
    assert row["words"] == ["Summary", "of", "Title", "1."]
    assert row["expires_at"]


def test_skips_known_articles_before_calling_llm(monkeypatch, fake_db, llm_calls):
    fake_db["existing"] = {"guardian:1"}
    monkeypatch.setattr(sources, "fetch_all", lambda: [article(1), article(2)])

    assert ingest.run() == 0
    assert llm_calls == ["Title 2"], "must not spend LLM quota on duplicates"


def test_nothing_new_is_success(monkeypatch, fake_db, llm_calls):
    fake_db["existing"] = {"guardian:1"}
    monkeypatch.setattr(sources, "fetch_all", lambda: [article(1)])

    assert ingest.run() == 0
    assert llm_calls == []


def test_respects_articles_per_run(monkeypatch, fake_db, llm_calls):
    monkeypatch.setattr(ingest, "ARTICLES_PER_RUN", 2)
    monkeypatch.setattr(sources, "fetch_all", lambda: [article(n) for n in range(5)])

    ingest.run()
    assert len(llm_calls) == 2


def test_one_failed_summary_does_not_stop_the_run(monkeypatch, fake_db):
    def flaky(title, body):
        if title == "Title 1":
            raise RuntimeError("LLM hiccup")
        return "Fine."

    monkeypatch.setattr(summarize, "summarize", flaky)
    monkeypatch.setattr(sources, "fetch_all", lambda: [article(1), article(2)])

    assert ingest.run() == 0
    assert [r["external_id"] for r in fake_db["inserted"]] == ["guardian:2"]


def test_rate_limit_stops_early_but_keeps_finished_work(monkeypatch, fake_db):
    def limited(title, body):
        if title == "Title 2":
            raise summarize.RateLimitedError("quota")
        return "Fine."

    monkeypatch.setattr(summarize, "summarize", limited)
    monkeypatch.setattr(sources, "fetch_all", lambda: [article(n) for n in range(1, 4)])

    assert ingest.run() == 0
    assert [r["external_id"] for r in fake_db["inserted"]] == ["guardian:1"]


def test_fails_when_new_articles_exist_but_none_inserted(monkeypatch, fake_db):
    def broken(title, body):
        raise RuntimeError("bad API key")

    monkeypatch.setattr(summarize, "summarize", broken)
    monkeypatch.setattr(sources, "fetch_all", lambda: [article(1)])

    assert ingest.run() == 1, "the Actions run should go red"


def test_seed_rows_are_valid():
    rows = seed.rows()
    assert len(rows) == len(seed.SAMPLES)
    assert all(r["external_id"].startswith("seed:") for r in rows)
    assert all(r["words"] == r["summary"].split() for r in rows)
