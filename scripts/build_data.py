#!/usr/bin/env python3
"""Convert the reference CSV export into the site's JSON data file.

    python3 scripts/build_data.py

Reads  : data/references.csv   (Notion CSV export)
Writes : data/cards.json       (consumed by app.js)

One CSV row  ->  one card object. A card is stored once; its `tags` array is
what places it in multiple drawers. Re-run this whenever the CSV changes
(e.g. once Note_EN gets filled in) — no other code needs to change.
"""

import csv
import json
import re
import sys
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "references.csv"
JSON_PATH = ROOT / "data" / "cards.json"

# Must match drawers.js (order irrelevant here, membership is what matters).
DRAWERS = [
    "Irreversibility", "Media Archaeology", "Fermentation", "Uncontrollability",
    "Textile", "Childhood", "Relation", "Film Souping", "Boyhood", "Red Thread",
    "Girl is a Spectrum", "Childhood Seeker", "Nature", "Light", "Film", "The Old",
]

URL_RE = re.compile(r"https?://[^\s,)]+")


def slugify(text):
    """ASCII slug from the parts of a title we can transliterate cheaply."""
    ascii_only = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    ascii_only = re.sub(r"-{2,}", "-", ascii_only)
    return ascii_only


def make_id(title, index, used):
    base = slugify(title)
    if len(base) < 2:
        # title has no latin content — fall back to a stable content hash
        base = "ref-" + hashlib.sha1(title.encode("utf-8")).hexdigest()[:6]
    candidate = base
    n = 2
    while candidate in used:
        candidate = f"{base}-{n}"
        n += 1
    used.add(candidate)
    return candidate


def split_tags(raw):
    return [t.strip() for t in raw.split(",") if t.strip()] if raw else []


def main():
    if not CSV_PATH.exists():
        sys.exit(f"missing {CSV_PATH}")

    with CSV_PATH.open(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.DictReader(fh))

    cards = []
    used_ids = set()
    problems = []

    for i, row in enumerate(rows):
        row = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        title = row.get("Title", "")
        if not title:
            problems.append(f"row {i + 1}: no Title — skipped")
            continue

        tags = split_tags(row.get("Tags", ""))
        for t in tags:
            if t not in DRAWERS:
                problems.append(f'"{title}": unknown tag "{t}"')
        if not tags:
            problems.append(f'"{title}": no tags — will not appear in any drawer')

        source = row.get("Source", "")
        url_match = URL_RE.search(source)

        cards.append({
            "id": make_id(title, i, used_ids),
            "title": title,
            "source": source,
            "sourceUrl": url_match.group(0) if url_match else "",
            "dateFound": row.get("Date Found", ""),
            "image": row.get("Image", ""),
            "note": {
                "ko": row.get("Note_KO", ""),
                "fr": row.get("Note_FR", ""),
                "en": row.get("Note_EN", ""),
            },
            "tags": tags,
        })

    out = {
        "generatedFrom": "data/references.csv",
        "drawers": DRAWERS,
        "cards": cards,
    }
    JSON_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")

    print(f"wrote {JSON_PATH.relative_to(ROOT)} — {len(cards)} cards")
    counts = {d: sum(1 for c in cards if d in c["tags"]) for d in DRAWERS}
    empty = [d for d, n in counts.items() if n == 0]
    if empty:
        print("empty drawers:", ", ".join(empty))
    if problems:
        print("\nnotes:")
        for p in problems:
            print("  -", p)


if __name__ == "__main__":
    main()
