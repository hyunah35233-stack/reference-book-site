// Stage 1 — plain data-flow build: list + tag filters + card/note pages + i18n.
// No visuals yet. Everything here should survive into Stage 2; only the CSS
// and a drawer-cabinet layer get added on top.

(function () {
  "use strict";

  var DRAWERS = window.DRAWERS || [];
  var I18N = window.I18N || {};
  var LANGS = window.I18N_LANGS || ["ko", "fr", "en"];

  var state = { lang: pickLang(), cards: [], loaded: false, error: null };

  // ---------- language ----------
  function pickLang() {
    var saved = null;
    try { saved = localStorage.getItem("rbk.lang"); } catch (e) {}
    if (saved && LANGS.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) !== -1 ? nav : "ko";
  }
  function setLang(lang) {
    if (LANGS.indexOf(lang) === -1) return;
    state.lang = lang;
    try { localStorage.setItem("rbk.lang", lang); } catch (e) {}
    document.documentElement.lang = lang;
    render();
  }
  function t(key) {
    var d = I18N[state.lang] || {};
    return (d.ui && key in d.ui) ? d.ui[key] : key;
  }
  function drawerLabel(key) {
    var d = I18N[state.lang] || {};
    return (d.drawers && d.drawers[key]) || key;
  }

  // Note text for the current language, with a fallback chain.
  // Requested lang -> (en asks fr first, per spec) -> fr -> ko -> en.
  function noteFor(card) {
    var note = card.note || {};
    var want = state.lang;
    if (note[want]) return { text: note[want], fallback: false };
    var chain = want === "en" ? ["fr", "ko"] : ["en", "fr", "ko"];
    for (var i = 0; i < chain.length; i++) {
      if (note[chain[i]]) return { text: note[chain[i]], fallback: true, from: chain[i] };
    }
    return { text: "", fallback: false };
  }

  // ---------- data helpers ----------
  function cardById(id) {
    for (var i = 0; i < state.cards.length; i++) {
      if (state.cards[i].id === id) return state.cards[i];
    }
    return null;
  }
  function cardsInDrawer(key) {
    return state.cards.filter(function (c) { return (c.tags || []).indexOf(key) !== -1; });
  }

  // ---------- integrity check ----------
  function validate() {
    var problems = [], seen = {}, ok = {};
    DRAWERS.forEach(function (d) { ok[d] = true; });
    state.cards.forEach(function (c, i) {
      var label = c.id || c.title || "card #" + (i + 1);
      if (!c.id) problems.push(label + ": missing id");
      if (c.id && seen[c.id]) problems.push(label + ": duplicate id");
      if (c.id) seen[c.id] = true;
      if (!c.title) problems.push(label + ": missing title");
      if (!c.tags || !c.tags.length) problems.push(label + ": no tags");
      (c.tags || []).forEach(function (tag) {
        if (!ok[tag]) problems.push(label + ': unknown tag "' + tag + '"');
      });
    });
    return problems;
  }

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, kids) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (kid) {
      if (kid == null) return;
      node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  // ---------- routing ----------
  function parseRoute() {
    var raw = (location.hash || "").replace(/^#/, "");
    var parts = raw.split("/").filter(Boolean); // ["", "drawer", "x"] -> ["drawer","x"]
    if (parts[0] === "card" && parts[1]) return { name: "note", id: decodeURIComponent(parts[1]) };
    if (parts[0] === "drawer" && parts[1]) return { name: "home", drawer: decodeURIComponent(parts[1]) };
    return { name: "home", drawer: null };
  }
  function go(hash) { location.hash = hash; }

  // ---------- views ----------
  function langSwitch() {
    return h("nav", { class: "langswitch", "aria-label": t("langSwitch") },
      LANGS.map(function (code) {
        return h("button", {
          class: "lang" + (code === state.lang ? " is-active" : ""),
          type: "button",
          "aria-pressed": code === state.lang ? "true" : "false",
          onclick: function () { setLang(code); },
          text: code.toUpperCase(),
        });
      }));
  }

  function warningsBox() {
    var problems = validate();
    if (!problems.length) return null;
    return h("details", { class: "warnings" }, [
      h("summary", { text: t("dataIssues") + " (" + problems.length + ")" }),
      h("ul", {}, problems.map(function (p) { return h("li", { text: p }); })),
    ]);
  }

  function filterBar(activeDrawer) {
    var bar = h("div", { class: "filters" });
    bar.appendChild(h("a", {
      class: "filter" + (activeDrawer ? "" : " is-active"),
      href: "#/",
      text: t("allDrawers") + " (" + state.cards.length + ")",
    }));
    DRAWERS.forEach(function (key) {
      var n = cardsInDrawer(key).length;
      bar.appendChild(h("a", {
        class: "filter" + (key === activeDrawer ? " is-active" : "") + (n === 0 ? " is-empty" : ""),
        href: "#/drawer/" + encodeURIComponent(key),
        text: drawerLabel(key) + " (" + n + ")",
      }));
    });
    return bar;
  }

  function cardRow(card) {
    var meta = [card.source, card.dateFound].filter(Boolean).join("  ·  ");
    return h("a", { class: "card", href: "#/card/" + encodeURIComponent(card.id) }, [
      h("span", { class: "card-title", text: card.title }),
      meta ? h("span", { class: "card-meta", text: meta }) : null,
      h("span", { class: "card-tags" }, (card.tags || []).map(function (tg) {
        return h("span", { class: "chip", text: drawerLabel(tg) });
      })),
    ]);
  }

  function renderHome(activeDrawer) {
    var app = document.getElementById("app");
    app.innerHTML = "";

    app.appendChild(h("header", { class: "topbar" }, [
      h("span", { class: "brand", text: (I18N[state.lang] && I18N[state.lang].ui.siteName) || "" }),
      langSwitch(),
    ]));

    var w = warningsBox();
    if (w) app.appendChild(w);

    app.appendChild(filterBar(activeDrawer));

    var list = activeDrawer ? cardsInDrawer(activeDrawer) : state.cards.slice();

    var here = [list.length, t("countSuffix")].filter(Boolean).join(" ");
    var total = [state.cards.length, t("totalSuffix")].filter(Boolean).join(" ");
    app.appendChild(h("p", { class: "count" }, [
      (activeDrawer ? drawerLabel(activeDrawer) + " — " : "") + here + "  /  " + total,
    ]));

    if (!list.length) {
      app.appendChild(h("p", { class: "empty", text: t("emptyDrawer") }));
      return;
    }
    var wrap = h("section", { class: "list" });
    list.forEach(function (c) { wrap.appendChild(cardRow(c)); });
    app.appendChild(wrap);
  }

  function renderNote(id) {
    var app = document.getElementById("app");
    app.innerHTML = "";
    var card = cardById(id);

    app.appendChild(h("header", { class: "topbar" }, [
      h("a", { class: "back", href: "#/", text: t("back") }),
      langSwitch(),
    ]));

    if (!card) {
      app.appendChild(h("p", { class: "empty", text: "Not found: " + id }));
      return;
    }

    var page = h("article", { class: "note" });

    page.appendChild(h("h1", { class: "note-title", text: card.title }));

    var sub = [];
    if (card.source) sub.push(t("cardSource") + ": " + card.source);
    if (card.dateFound) sub.push(t("cardDate") + ": " + card.dateFound);
    if (sub.length) page.appendChild(h("p", { class: "note-sub", text: sub.join("  ·  ") }));

    // image slot — empty for now, structure ready
    page.appendChild(h("div", { class: "note-image" + (card.image ? "" : " is-empty") },
      card.image
        ? [h("img", { src: card.image, alt: card.title })]
        : [h("span", { text: t("imagePending") })]));

    // description
    var nf = noteFor(card);
    var descBlock = h("div", { class: "note-desc" });
    descBlock.appendChild(h("h2", { class: "note-h", text: t("description") }));
    if (nf.text) {
      if (nf.fallback) descBlock.appendChild(h("p", { class: "note-fallback", text: t("fallbackFromFr") }));
      descBlock.appendChild(h("p", { class: "note-body", text: nf.text }));
    } else {
      descBlock.appendChild(h("p", { class: "note-body is-empty", text: t("noNote") }));
    }
    page.appendChild(descBlock);

    // related tags -> jump to that drawer
    if (card.tags && card.tags.length) {
      var tagsBlock = h("div", { class: "note-tags" });
      tagsBlock.appendChild(h("h2", { class: "note-h", text: t("relatedTags") }));
      var row = h("div", { class: "tag-row" });
      card.tags.forEach(function (key) {
        row.appendChild(h("a", {
          class: "tag-link",
          href: "#/drawer/" + encodeURIComponent(key),
          text: drawerLabel(key),
        }));
      });
      tagsBlock.appendChild(row);
      page.appendChild(tagsBlock);
    }

    // source link
    if (card.sourceUrl) {
      page.appendChild(h("p", { class: "note-source" }, [
        h("a", { href: card.sourceUrl, target: "_blank", rel: "noopener noreferrer", text: t("sourceLink") }),
      ]));
    }

    app.appendChild(page);
    window.scrollTo(0, 0);
  }

  // ---------- render dispatch ----------
  function render() {
    document.documentElement.lang = state.lang;
    if (state.error) {
      document.getElementById("app").innerHTML =
        '<p class="empty">Could not load data/cards.json — ' + state.error + "</p>";
      return;
    }
    if (!state.loaded) return;
    var r = parseRoute();
    if (r.name === "note") renderNote(r.id);
    else renderHome(r.drawer);
  }

  // ---------- boot ----------
  window.addEventListener("hashchange", render);

  fetch("data/cards.json", { cache: "no-cache" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      state.cards = (data && data.cards) || [];
      state.loaded = true;
      render();
    })
    .catch(function (err) {
      state.error = String(err && err.message || err);
      render();
    });
})();
