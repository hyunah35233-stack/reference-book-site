# Reference Catalog

A personal reference-book website that uses an old library card catalog as its
interface metaphor. Hand-drawn (rough.js) cut-paper visual style. KO / FR / EN.

Plain static site — no build step.

## Run locally

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

- `index.html` — the card-catalog cabinet (main site)
- `list.html` — a plain list view of the same data (for checking the data)

## Data

One row of `data/references.csv` = one card. `tags` place a card in multiple
drawers. After editing the CSV, regenerate the JSON the site reads:

```bash
python3 scripts/build_data.py   # writes data/cards.json
```

`i18n.js` holds every piece of translated UI text and the drawer labels.
Card titles and sources are shown as-is in every language. Note text uses
`Note_KO` / `Note_FR` / `Note_EN`; if the chosen language is missing it falls
back (EN → FR → KO) with a small notice.
