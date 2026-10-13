"""News sources. Each source returns a list of RawArticle; add new APIs here."""

import os
import re
from dataclasses import dataclass

import httpx


@dataclass
class RawArticle:
    external_id: str
    title: str
    source: str
    url: str
    section: str | None
    published_at: str | None
    body: str


def clean_html(content: str) -> str:
    """Strip tags/entities and collapse whitespace."""
    text = re.sub(r"<[^>]+>", " ", content)
    text = re.sub(r"&[a-zA-Z0-9#]+;", " ", text)
    return " ".join(text.split())


def fetch_guardian(page_size: int = 30) -> list[RawArticle]:
    api_key = os.environ["GUARDIAN_API_KEY"]
    response = httpx.get(
        "https://content.guardianapis.com/search",
        params={
            "api-key": api_key,
            "show-fields": "body,headline,trailText",
            "page-size": page_size,
            "order-by": "newest",
            "type": "article",
        },
        headers={"User-Agent": "TapTimes/1.0"},
        timeout=30,
    )
    response.raise_for_status()

    articles: list[RawArticle] = []
    for item in response.json().get("response", {}).get("results", []):
        fields = item.get("fields", {})
        body = clean_html(fields.get("body") or fields.get("trailText") or "")
        # Live blogs, galleries, etc. are too short to summarize meaningfully.
        if len(body) < 500:
            continue
        articles.append(
            RawArticle(
                external_id=f"guardian:{item['id']}",
                title=fields.get("headline") or item.get("webTitle") or "Untitled",
                source="The Guardian",
                url=item.get("webUrl", ""),
                section=item.get("sectionName"),
                published_at=item.get("webPublicationDate"),
                body=body[:6000],
            )
        )
    return articles


def fetch_all() -> list[RawArticle]:
    """Every configured source, newest first per source."""
    return fetch_guardian()
