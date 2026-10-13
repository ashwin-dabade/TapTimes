import httpx
import pytest
from conftest import fake_response

import summarize


def gemini_ok(text: str) -> httpx.Response:
    return fake_response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})


class TestNormalize:
    def test_replaces_typographic_characters(self):
        assert summarize.normalize("“Hi” — it’s…") == '"Hi" - it\'s...'

    def test_strips_markdown(self):
        assert summarize.normalize("**Bold** and _under_ and `code`") == "Bold and under and code"

    def test_collapses_whitespace(self):
        assert summarize.normalize("  a \n\n b c  ") == "a b c"


class TestSummarize:
    def test_returns_normalized_summary(self, monkeypatch):
        monkeypatch.setattr(summarize.httpx, "post", lambda *a, **k: gemini_ok("**News** — here."))
        assert summarize.summarize("Title", "Body") == "News - here."

    def test_retries_after_rate_limit(self, monkeypatch):
        responses = [fake_response(429, headers={"retry-after": "2"}), gemini_ok("Done.")]
        sleeps = []
        monkeypatch.setattr(summarize.httpx, "post", lambda *a, **k: responses.pop(0))
        monkeypatch.setattr(summarize.time, "sleep", sleeps.append)

        assert summarize.summarize("T", "B") == "Done."
        assert responses == []
        assert any(s >= 2 for s in sleeps), "should honor Retry-After"

    def test_retries_server_errors(self, monkeypatch):
        responses = [fake_response(503, text="busy"), gemini_ok("Done.")]
        monkeypatch.setattr(summarize.httpx, "post", lambda *a, **k: responses.pop(0))
        assert summarize.summarize("T", "B") == "Done."

    def test_gives_up_after_max_retries(self, monkeypatch):
        monkeypatch.setattr(summarize.httpx, "post", lambda *a, **k: fake_response(429))
        with pytest.raises(summarize.RateLimitedError):
            summarize.summarize("T", "B")

    def test_client_errors_are_not_retried(self, monkeypatch):
        calls = []

        def post(*a, **k):
            calls.append(1)
            return fake_response(400, text="bad request")

        monkeypatch.setattr(summarize.httpx, "post", post)
        with pytest.raises(RuntimeError, match="400"):
            summarize.summarize("T", "B")
        assert len(calls) == 1

    def test_empty_summary_is_an_error(self, monkeypatch):
        monkeypatch.setattr(summarize.httpx, "post", lambda *a, **k: gemini_ok("   "))
        with pytest.raises(ValueError):
            summarize.summarize("T", "B")

    def test_groq_provider(self, monkeypatch):
        monkeypatch.setattr(summarize, "PROVIDER", "groq")
        monkeypatch.setenv("GROQ_API_KEY", "test-key")
        monkeypatch.setattr(
            summarize.httpx,
            "post",
            lambda *a, **k: fake_response(200, json={"choices": [{"message": {"content": "From Groq."}}]}),
        )
        assert summarize.summarize("T", "B") == "From Groq."

    def test_unknown_provider(self, monkeypatch):
        monkeypatch.setattr(summarize, "PROVIDER", "nope")
        with pytest.raises(ValueError, match="Unknown LLM_PROVIDER"):
            summarize.summarize("T", "B")
