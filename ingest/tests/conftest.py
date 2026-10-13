import httpx
import pytest

import summarize


@pytest.fixture(autouse=True)
def no_real_network_or_sleep(monkeypatch):
    """Tests must never hit real APIs or wait on real rate-limit delays."""

    def blocked(*args, **kwargs):
        raise AssertionError("Test tried to make a real HTTP request; mock it instead")

    monkeypatch.setattr(httpx, "get", blocked)
    monkeypatch.setattr(httpx, "post", blocked)
    monkeypatch.setattr(summarize.time, "sleep", lambda seconds: None)
    monkeypatch.setattr(summarize, "MIN_INTERVAL", 0)
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    monkeypatch.setenv("GUARDIAN_API_KEY", "test-key")


def fake_response(status: int, json=None, text: str = "", headers=None) -> httpx.Response:
    return httpx.Response(
        status,
        json=json,
        text=text if json is None else None,
        headers=headers,
        request=httpx.Request("POST", "https://example.test"),
    )
