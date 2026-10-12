"""Minimal Supabase (PostgREST) access with the service-role key.

Plain httpx instead of the supabase SDK: one small dependency, no version
conflicts like the ones that broke the old Railway build.
"""
import os
from typing import Iterable, List, Set

import httpx


def _client() -> httpx.Client:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return httpx.Client(
        base_url=f"{url}/rest/v1",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=30,
    )


def existing_external_ids(ids: Iterable[str]) -> Set[str]:
    ids = list(ids)
    if not ids:
        return set()
    quoted = ",".join('"' + i.replace('"', '\\"') + '"' for i in ids)
    with _client() as client:
        response = client.get(
            "/articles", params={"select": "external_id", "external_id": f"in.({quoted})"}
        )
        response.raise_for_status()
        return {row["external_id"] for row in response.json()}


def insert_articles(rows: List[dict]) -> int:
    if not rows:
        return 0
    with _client() as client:
        response = client.post(
            "/articles",
            params={"on_conflict": "external_id"},
            headers={"Prefer": "resolution=ignore-duplicates,return=representation"},
            json=rows,
        )
        response.raise_for_status()
        return len(response.json())


def delete_expired() -> int:
    with _client() as client:
        response = client.delete(
            "/articles",
            # 'now' is a Postgres timestamp literal for the current time.
            params={"expires_at": "lt.now"},
            headers={"Prefer": "return=representation"},
        )
        response.raise_for_status()
        return len(response.json())


def delete_seed_articles() -> int:
    with _client() as client:
        response = client.delete(
            "/articles",
            params={"external_id": "like.seed:*"},
            headers={"Prefer": "return=representation"},
        )
        response.raise_for_status()
        return len(response.json())


def delete_all_articles() -> int:
    with _client() as client:
        response = client.delete(
            "/articles",
            params={"id": "not.is.null"},
            headers={"Prefer": "return=representation"},
        )
        response.raise_for_status()
        return len(response.json())
