"""Load sample articles so the app can be tested without the news API or LLM.

Usage:
    python ingest/seed.py            # add sample articles (safe to re-run)
    python ingest/seed.py --remove   # delete only the sample articles
"""
import sys
from datetime import datetime, timedelta, timezone

import db
from ingest import load_dotenv

SAMPLES = [
    {
        "title": "Quick test: a very short article",
        "section": "Testing",
        "summary": "The quick brown fox jumps over the lazy dog.",
    },
    {
        "title": "City opens new bike lanes downtown",
        "section": "Local",
        "summary": (
            "The city opened six miles of protected bike lanes downtown on Monday, linking the train station "
            "to the university and the riverfront park. Officials said the lanes use concrete barriers instead "
            "of paint so drivers cannot drift into them. Local shops were worried about losing parking, but a "
            "pilot program last spring found that foot traffic rose on streets with new lanes. The city plans "
            "to add another four miles next year if ridership keeps growing."
        ),
    },
    {
        "title": "Researchers test a cheaper way to store solar power",
        "section": "Science",
        "summary": (
            "Engineers at a state university have built a battery that stores solar energy in heated sand. "
            "During sunny hours, extra electricity warms the sand to several hundred degrees, and at night the "
            "heat is turned back into power. The team says the design costs far less than lithium batteries "
            "and uses materials that are easy to find. The prototype can power a small building for about a "
            "day. The next step is a larger test at a farm that already runs on solar panels."
        ),
    },
    {
        "title": "Local library adds a tool lending shelf",
        "section": "Community",
        "summary": (
            "The public library now lends out tools as well as books. Members can borrow drills, ladders, "
            "sewing machines, and even a pressure washer for up to one week. The idea came from residents who "
            "said they rarely needed these items but could not afford to buy them. Librarians added a short "
            "safety guide to each kit. In the first month, more than two hundred tools were checked out, and "
            "the library is asking for donations to grow the collection."
        ),
    },
    {
        "title": "High school team wins regional robotics contest",
        "section": "Education",
        "summary": (
            "A team of eight students won the regional robotics contest on Saturday with a robot that sorts "
            "recycling by material. The robot uses a camera and a simple model to tell plastic from metal and "
            "paper, then pushes each item into the right bin. The students built most of the parts in their "
            "school shop and wrote the software over winter break. They will travel to the national contest "
            "in the spring, and they are raising money to cover the trip."
        ),
    },
]


def rows() -> list:
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    return [
        {
            "external_id": f"seed:{i}",
            "title": s["title"],
            "source": "TapTimes Sample",
            "url": "https://example.com",
            "section": s["section"],
            "published_at": None,
            "summary": s["summary"],
            "words": s["summary"].split(),
            "expires_at": expires_at,
        }
        for i, s in enumerate(SAMPLES)
    ]


def main() -> int:
    load_dotenv()
    if "--remove" in sys.argv:
        print(f"Removed {db.delete_seed_articles()} sample articles")
    else:
        inserted = db.insert_articles(rows())
        print(f"Inserted {inserted} sample articles ({len(SAMPLES) - inserted} were already there)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
