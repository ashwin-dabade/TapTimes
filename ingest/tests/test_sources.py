from conftest import fake_response

import sources

LONG_BODY = "<p>" + "Real news sentence. " * 40 + "</p>"


def guardian_result(id_, body=LONG_BODY, **fields):
    return {
        "id": id_,
        "webTitle": f"Web title {id_}",
        "webUrl": f"https://www.theguardian.com/{id_}",
        "sectionName": "World news",
        "webPublicationDate": "2026-10-12T06:00:00Z",
        "fields": {"body": body, **fields},
    }


def test_clean_html_strips_tags_and_entities():
    assert sources.clean_html("<p>Hello&nbsp;<b>world</b></p>\n<p>Again</p>") == "Hello world Again"


def test_fetch_guardian_parses_and_filters(monkeypatch):
    payload = {
        "response": {
            "results": [
                guardian_result("world/a", headline="Headline A"),
                guardian_result("world/short", body="<p>Too short.</p>"),
                guardian_result("world/b"),
            ]
        }
    }
    monkeypatch.setattr(sources.httpx, "get", lambda *a, **k: fake_response(200, json=payload))

    articles = sources.fetch_guardian()

    assert [a.external_id for a in articles] == ["guardian:world/a", "guardian:world/b"]
    first = articles[0]
    assert first.title == "Headline A"
    assert first.source == "The Guardian"
    assert first.section == "World news"
    assert "<p>" not in first.body
    # Falls back to webTitle when there is no headline field.
    assert articles[1].title == "Web title world/b"
