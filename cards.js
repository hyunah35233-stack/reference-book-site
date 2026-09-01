// ---------------------------------------------------------------------------
// CARDS — the single source of truth.
//
// One reference = ONE card object. Never duplicate a card.
// A card appears in a drawer purely through its `tags` array.
// Tag by CONCEPTUAL relevance ("every drawer this could belong to"),
// not by "where I found it". Tag values must come from window.DRAWERS.
//
// Shape:
// {
//   id:     "unique-slug",                 // stable, kebab-case
//   title:  "March 23, 2026 — Street mural, Gwanghwamun 23-ga",
//   image:  "images/foo.jpg",              // optional (path or URL)
//   source: "One line: where this is from / credit / link",
//   note:   "My own memo — why it matters, what it connects to.",
//   tags:   ["Media Archaeology", "The Old"]
// }
// ---------------------------------------------------------------------------
window.CARDS = [
  // --- PLACEHOLDER EXAMPLES (delete once real cards are in) ---
  {
    id: "example-card-catalog",
    title: "Sample — Library card catalog, disused",
    image: "",
    source: "Placeholder entry, not a real reference",
    note: "Only here to show the data shape. One card, many drawers via tags.",
    tags: ["Media Archaeology", "The Old", "Relation"],
  },
  {
    id: "example-film-soup",
    title: "Sample — Film soaked in kombucha before developing",
    image: "",
    source: "Placeholder entry, not a real reference",
    note: "Shows how one item can sit across process-based drawers at once.",
    tags: ["Film Souping", "Fermentation", "Uncontrollability", "Film"],
  },
];
