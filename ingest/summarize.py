"""LLM summarization with free-tier-friendly throttling.

LLM_PROVIDER selects the backend (gemini | groq). Calls are spaced at least
LLM_MIN_INTERVAL_SECONDS apart, and rate-limit (429) or transient 5xx errors
are retried with exponential backoff, honoring Retry-After when given.
"""
import os
import random
import re
import time

import httpx

PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
# "-latest" aliases follow Google's current model, so a retired model id can't
# silently break the nightly job.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
MIN_INTERVAL = float(os.getenv("LLM_MIN_INTERVAL_SECONDS", "7"))
MAX_RETRIES = 5

PROMPT = """Summarize the news article below in {min_words}-{max_words} words for a typing practice app.

Rules:
- Plain prose in one paragraph. No headings, bullet points, markdown, or emoji.
- Use only standard keyboard characters: no curly quotes, em dashes, or special symbols.
- Do not start with phrases like "This article" or "The article". Just state the news.
- Output only the summary.

Article title: {title}

Article:
{body}"""

_last_call = 0.0


class RateLimitedError(Exception):
    pass


def _throttle() -> None:
    global _last_call
    wait = MIN_INTERVAL - (time.monotonic() - _last_call)
    if wait > 0:
        time.sleep(wait)
    _last_call = time.monotonic()


def _call_gemini(prompt: str) -> httpx.Response:
    return httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
        },
        timeout=60,
    )


def _parse_gemini(data: dict) -> str:
    parts = data["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts)


def _call_groq(prompt: str) -> httpx.Response:
    return httpx.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {os.environ['GROQ_API_KEY']}"},
        json={
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 1024,
        },
        timeout=60,
    )


def _parse_groq(data: dict) -> str:
    return data["choices"][0]["message"]["content"]


_BACKENDS = {
    "gemini": (_call_gemini, _parse_gemini),
    "groq": (_call_groq, _parse_groq),
}

# Map typographic characters to what a keyboard can type.
_REPLACEMENTS = {
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "–": "-", "—": " - ", "…": "...", " ": " ",
}


def normalize(text: str) -> str:
    for src, dst in _REPLACEMENTS.items():
        text = text.replace(src, dst)
    text = re.sub(r"[*#_`]", "", text)  # stray markdown
    return " ".join(text.split())


def summarize(title: str, body: str, min_words: int = 100, max_words: int = 150) -> str:
    if PROVIDER not in _BACKENDS:
        raise ValueError(f"Unknown LLM_PROVIDER {PROVIDER!r}; use one of {list(_BACKENDS)}")
    call, parse = _BACKENDS[PROVIDER]
    prompt = PROMPT.format(min_words=min_words, max_words=max_words, title=title, body=body)

    for attempt in range(MAX_RETRIES):
        _throttle()
        response = call(prompt)
        if response.status_code == 200:
            text = normalize(parse(response.json()))
            if not text:
                raise ValueError("LLM returned an empty summary")
            return text
        if response.status_code == 429 or response.status_code >= 500:
            retry_after = response.headers.get("retry-after")
            delay = float(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt * 5
            delay += random.uniform(0, 2)
            print(f"  {PROVIDER} returned {response.status_code}; retrying in {delay:.0f}s")
            time.sleep(delay)
            continue
        raise RuntimeError(f"{PROVIDER} error {response.status_code}: {response.text[:300]}")

    raise RateLimitedError(f"{PROVIDER} still rate limited after {MAX_RETRIES} attempts")
