// Stage 1 — plain list + tag filters. No visuals, just the data working.

(function () {
  "use strict";

  var DRAWERS = window.DRAWERS || [];
  var CARDS = window.CARDS || [];

  var state = {
    active: null, // null = show everything; otherwise a drawer name
  };

  // --- Data integrity check (surfaced on the page, not hidden in console) ---
  function validate() {
    var problems = [];
    var seen = {};
    var drawerSet = {};
    DRAWERS.forEach(function (d) { drawerSet[d] = true; });

    CARDS.forEach(function (c, i) {
      var label = c.id || c.title || "card #" + (i + 1);
      if (!c.id) problems.push(label + ": missing id");
      if (c.id && seen[c.id]) problems.push(label + ": duplicate id");
      if (c.id) seen[c.id] = true;
      if (!c.title) problems.push(label + ": missing title");
      if (!c.tags || !c.tags.length) {
        problems.push(label + ": no tags (won't appear in any drawer)");
      }
      (c.tags || []).forEach(function (t) {
        if (!drawerSet[t]) problems.push(label + ': unknown tag "' + t + '"');
      });
    });
    return problems;
  }

  function countFor(drawer) {
    return CARDS.filter(function (c) {
      return (c.tags || []).indexOf(drawer) !== -1;
    }).length;
  }

  function visibleCards() {
    if (!state.active) return CARDS.slice();
    return CARDS.filter(function (c) {
      return (c.tags || []).indexOf(state.active) !== -1;
    });
  }

  // --- Rendering ---
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderFilters() {
    var wrap = document.getElementById("filters");
    wrap.innerHTML = "";

    var all = el("button", "filter" + (state.active ? "" : " is-active"), "All");
    all.addEventListener("click", function () { setActive(null); });
    wrap.appendChild(all);

    DRAWERS.forEach(function (d) {
      var n = countFor(d);
      var btn = el(
        "button",
        "filter" + (state.active === d ? " is-active" : "") + (n === 0 ? " is-empty" : ""),
        d + " (" + n + ")"
      );
      btn.addEventListener("click", function () { setActive(d); });
      wrap.appendChild(btn);
    });
  }

  function renderCard(c) {
    var card = el("article", "card");

    var head = el("div", "card-head");
    head.appendChild(el("span", "card-label", c.title || "(untitled)"));
    card.appendChild(head);

    var body = el("div", "card-body");

    if (c.image) {
      var fig = el("figure", "card-fig");
      var img = document.createElement("img");
      img.src = c.image;
      img.alt = c.title || "";
      img.loading = "lazy";
      fig.appendChild(img);
      body.appendChild(fig);
    }

    if (c.source) {
      var src = el("p", "card-source");
      src.appendChild(el("span", "field-label", "Source"));
      src.appendChild(document.createTextNode(" " + c.source));
      body.appendChild(src);
    }

    if (c.note) {
      var note = el("p", "card-note");
      note.appendChild(el("span", "field-label", "Note"));
      note.appendChild(document.createTextNode(" " + c.note));
      body.appendChild(note);
    }

    var tags = el("div", "card-tags");
    (c.tags || []).forEach(function (t) {
      var tag = el("button", "tag" + (state.active === t ? " is-active" : ""), t);
      tag.addEventListener("click", function () { setActive(t); });
      tags.appendChild(tag);
    });
    body.appendChild(tags);

    card.appendChild(body);
    return card;
  }

  function renderList() {
    var listWrap = document.getElementById("list");
    var meta = document.getElementById("meta");
    listWrap.innerHTML = "";

    var cards = visibleCards();
    meta.textContent =
      (state.active ? '"' + state.active + '" — ' : "All drawers — ") +
      cards.length +
      (cards.length === 1 ? " card" : " cards") +
      " / " + CARDS.length + " total";

    if (!cards.length) {
      listWrap.appendChild(el("p", "empty", "No cards here yet."));
      return;
    }
    cards.forEach(function (c) {
      listWrap.appendChild(renderCard(c));
    });
  }

  function renderWarnings() {
    var box = document.getElementById("warnings");
    var problems = validate();
    if (!problems.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    box.innerHTML = "";
    box.appendChild(el("strong", null, "Data issues:"));
    var ul = el("ul");
    problems.forEach(function (p) { ul.appendChild(el("li", null, p)); });
    box.appendChild(ul);
  }

  function setActive(drawer) {
    state.active = drawer;
    var url = drawer ? "#" + encodeURIComponent(drawer) : "#";
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", url);
    }
    renderFilters();
    renderList();
    window.scrollTo(0, 0);
  }

  function readHash() {
    var h = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
    if (h && DRAWERS.indexOf(h) !== -1) state.active = h;
  }

  readHash();
  renderWarnings();
  renderFilters();
  renderList();
  window.addEventListener("hashchange", function () {
    state.active = null;
    readHash();
    renderFilters();
    renderList();
  });
})();
