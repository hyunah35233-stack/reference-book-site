// Stage 2 — the hand-drawn cut-paper card catalog, wired to the Stage 1 data
// model: data/cards.json, KO/FR/EN i18n, and card -> note-page navigation
// (no flip). Routes: #/ , #/drawer/<key> , #/card/<id>.

(function () {
  "use strict";

  var DRAWERS = window.DRAWERS || [];
  var I18N = window.I18N || {};
  var LANGS = window.I18N_LANGS || ["ko", "fr", "en"];
  var R = window.rough || null;
  if (!R) document.body.classList.add("no-ink");

  var state = { lang: pickLang(), cards: [], loaded: false, error: null };

  // ---- design grid (must match cabinet.css) ----
  var CW = 1001, CH = 635, DW = 223, DH = 132, GAP = 18;
  var PADX = (CW - (DW * 4 + GAP * 3)) / 2;
  var PADY = (CH - (DH * 4 + GAP * 3)) / 2;

  // ---- wood-tone cut-paper palette ----
  var STROKE = "#4b3c2b";
  var STROKE_LT = "#9c8663";
  var BASE_WASH = "#c9b083";
  var PENCIL = "#ac8a5c";
  var LABEL_SLIP = "#f7f0dd";
  var KRAFT = "#dcc59a";
  var CARD_PAPER = "#f6eeda";
  var RULE_BLUE = "#8aa0bf";
  var PAPER_TONES = [
    "#e8d9b8", "#e4d3b0", "#ecddbe", "#e1d0a9",
    "#e7d7b5", "#e2d1ab", "#eadcbb", "#ded0a4",
  ];

  // ---------- i18n ----------
  function pickLang() {
    var saved = null;
    try { saved = localStorage.getItem("rbk.lang"); } catch (e) {}
    if (saved && LANGS.indexOf(saved) !== -1) return saved;
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return LANGS.indexOf(nav) !== -1 ? nav : "ko";
  }
  function setLang(lang) {
    if (LANGS.indexOf(lang) === -1 || lang === state.lang) return;
    state.lang = lang;
    try { localStorage.setItem("rbk.lang", lang); } catch (e) {}
    document.documentElement.lang = lang;
    renderLangSwitch();
    relabelDrawers();
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

  // ---------- helpers ----------
  function cardsFor(key) {
    return state.cards.filter(function (c) { return (c.tags || []).indexOf(key) !== -1; });
  }
  function cardById(id) {
    for (var i = 0; i < state.cards.length; i++) {
      if (state.cards[i].id === id) return state.cards[i];
    }
    return null;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag) { return document.createElementNS("http://www.w3.org/2000/svg", tag); }
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // ---------- rough.js drawing ----------
  function pen(svg) {
    var rc = R ? R.svg(svg) : null;
    return {
      rect: function (x, y, w, h, o) { if (rc) svg.appendChild(rc.rectangle(x, y, w, h, o)); },
      line: function (x1, y1, x2, y2, o) { if (rc) svg.appendChild(rc.line(x1, y1, x2, y2, o)); },
      poly: function (pts, o) { if (rc) svg.appendChild(rc.polygon(pts, o)); },
    };
  }
  function drawSized(svg, w, h, cb, pad) {
    pad = pad || 12;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", -pad + " " + -pad + " " + (w + pad * 2) + " " + (h + pad * 2));
    if (!R) return;
    cb(pen(svg), w, h);
  }
  function cutPoints(w, h, grow, jit, r) {
    var g = grow, out = [];
    var corners = [[-g, -g], [w + g, -g], [w + g, h + g], [-g, h + g]];
    for (var e = 0; e < 4; e++) {
      var a = corners[e], b = corners[(e + 1) % 4];
      for (var s = 0; s < 3; s++) {
        var tt = s / 3;
        out.push([
          a[0] + (b[0] - a[0]) * tt + (r() * 2 - 1) * jit,
          a[1] + (b[1] - a[1]) * tt + (r() * 2 - 1) * jit,
        ]);
      }
    }
    return out;
  }
  function cutPaper(p, w, h, opts) {
    var r = rng(opts.seed);
    var grow = opts.grow != null ? opts.grow : 5;
    var jit = opts.jit != null ? opts.jit : 2.6;
    p.poly(cutPoints(w, h, grow, jit, rng(opts.seed)), {
      fill: opts.fill, fillStyle: "solid", fillWeight: 2,
      stroke: "none", roughness: 1.4, bowing: 1, seed: opts.seed + 3,
    });
    if (opts.hatch) {
      p.poly(cutPoints(w, h, grow + 3, jit, rng(opts.seed + 1)), {
        fill: opts.hatch, fillStyle: "hachure",
        hachureAngle: opts.angle != null ? opts.angle : (-38 + r() * 76),
        hachureGap: 5.4 + r() * 2, fillWeight: 0.8 + r() * 0.35,
        stroke: "none", roughness: 2, bowing: 1.4, seed: opts.seed + 9,
      });
    }
    for (var i = 0; i < 2; i++) {
      p.poly(cutPoints(w, h, grow, jit, rng(opts.seed + 20 + i)), {
        fill: "none", stroke: opts.stroke || STROKE,
        strokeWidth: (opts.strokeWidth || 1) + (i ? 0 : 0.3),
        roughness: 1.5, bowing: 1, seed: opts.seed + 30 + i,
      });
    }
  }

  // ---------- cabinet frame + drawers ----------
  var stage = document.getElementById("stage");
  var drawersEl = document.getElementById("drawers");
  var frame = document.getElementById("cabinetFrame");

  function buildDrawers() {
    DRAWERS.forEach(function (key, idx) {
      var a = el("a", "drawer");
      a.href = "#/drawer/" + encodeURIComponent(key);
      a.setAttribute("data-drawer", key);
      var rot = rng(idx * 71 + 9);
      a.style.setProperty("--rot", (rot() * 4.4 - 2.2).toFixed(2) + "deg");

      var ink = svgEl("svg");
      ink.setAttribute("class", "drawer-ink");
      ink.setAttribute("aria-hidden", "true");
      a.appendChild(ink);

      var lab = el("span", "drawer-label", drawerLabel(key));
      lab.style.setProperty("--tilt", (rot() * 3 - 1.5).toFixed(2) + "deg");
      a.appendChild(lab);

      drawersEl.appendChild(a);
    });
  }
  function relabelDrawers() {
    drawersEl.querySelectorAll(".drawer").forEach(function (a) {
      var key = a.getAttribute("data-drawer");
      a.querySelector(".drawer-label").textContent = drawerLabel(key);
      a.setAttribute("aria-label", t("openDrawer") + ": " + drawerLabel(key));
    });
  }
  function paintDrawers() {
    drawersEl.querySelectorAll(".drawer").forEach(function (a, idx) {
      var ink = a.querySelector(".drawer-ink");
      var w = a.offsetWidth, h = a.offsetHeight;
      if (!w || !h) return;
      var seed = idx * 137 + 11;
      var paper = PAPER_TONES[idx % PAPER_TONES.length];
      drawSized(ink, w, h, function (p) {
        var r = rng(seed + 5);
        cutPaper(p, w, h, { seed: seed, fill: paper, hatch: PENCIL, grow: -1, jit: 3 });
        var lw = w * 0.84, lh = 48;
        p.rect(w / 2 - lw / 2 + (r() * 5 - 2.5), h / 2 - lh / 2 - 4 + (r() * 4 - 2), lw, lh, {
          roughness: 1.7, bowing: 1.4, stroke: STROKE, strokeWidth: 0.85,
          fill: LABEL_SLIP, fillStyle: "solid", seed: seed + 31,
        });
        var cx = w / 2 + (r() * 8 - 4), cy = h - 20 - r() * 3;
        p.rect(cx - 15, cy - 4, 30, 9, {
          roughness: 2, bowing: 2, stroke: STROKE, strokeWidth: 1,
          fill: PENCIL, fillStyle: "hachure", hachureGap: 3, fillWeight: 0.9, seed: seed + 21,
        });
      }, 16);
    });
  }
  function paintFrame() {
    while (frame.firstChild) frame.removeChild(frame.firstChild);
    frame.setAttribute("viewBox", "-18 -18 " + (CW + 36) + " " + (CH + 36));
    if (!R) return;
    var p = pen(frame);
    var r = rng(999);
    cutPaper(p, CW, CH, { seed: 900, fill: BASE_WASH, grow: 10, jit: 3.2, strokeWidth: 1.4 });
    for (var i = 1; i <= 3; i++) {
      var x = PADX + i * (DW + GAP) - GAP / 2;
      p.line(x, 12, x + (r() * 4 - 2), CH - 12, { roughness: 2.6, bowing: 1.5, stroke: STROKE_LT, strokeWidth: 0.8, seed: 100 + i });
      var y = PADY + i * (DH + GAP) - GAP / 2;
      p.line(12, y, CW - 12, y + (r() * 4 - 2), { roughness: 2.6, bowing: 1.5, stroke: STROKE_LT, strokeWidth: 0.8, seed: 200 + i });
    }
    p.line(6, 16, CW - 6, 16 + r() * 4, { roughness: 2.4, bowing: 2, stroke: STROKE, strokeWidth: 1, seed: 73 });
  }

  // ---------- responsive scaling ----------
  var cssW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--design-w"));
  var cssH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--design-h"));
  function fit() {
    var m = window.innerWidth < 640 ? 0.98 : 0.92;
    var s = Math.min((window.innerWidth * m) / cssW, (window.innerHeight * m) / cssH, 1.35);
    stage.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  }

  // ---------- language switch ----------
  var langNav = document.getElementById("langswitch");
  function renderLangSwitch() {
    langNav.innerHTML = "";
    LANGS.forEach(function (code) {
      var b = el("button", "lang" + (code === state.lang ? " is-active" : ""), code.toUpperCase());
      b.type = "button";
      b.setAttribute("aria-pressed", code === state.lang ? "true" : "false");
      b.addEventListener("click", function () { setLang(code); });
      langNav.appendChild(b);
    });
  }

  // ---------- tray (an opened drawer) ----------
  var overlay = document.getElementById("overlay");
  var room = document.getElementById("room");
  var notepage = document.getElementById("notepage");
  var trayLabel = document.getElementById("trayLabel");
  var trayClose = document.getElementById("trayClose");
  var trayCards = document.getElementById("trayCards");
  var trayInk = document.getElementById("trayInk");
  var tray = overlay.querySelector(".tray");
  var openKey = null;

  function openDrawer(key) {
    openKey = key;
    var btn = drawerButtonFor(key);
    drawersEl.querySelectorAll(".drawer.is-open").forEach(function (d) { d.classList.remove("is-open"); });
    if (btn) btn.classList.add("is-open");

    trayLabel.textContent = drawerLabel(key);
    trayClose.textContent = t("close");
    trayCards.innerHTML = "";

    var list = cardsFor(key);
    if (!list.length) {
      trayCards.appendChild(el("p", "tray-empty", t("emptyDrawer")));
    } else {
      list.forEach(function (c) { trayCards.appendChild(buildTrayCard(c)); });
    }
    overlay.hidden = false;
    // read of offsetWidth below forces layout, so measurements are valid now
    paintTray();
    paintTrayCards();
    trayClose.focus();
  }
  function closeTray() {
    overlay.hidden = true;
    openKey = null;
    drawersEl.querySelectorAll(".drawer.is-open").forEach(function (d) { d.classList.remove("is-open"); });
  }
  function paintTray() {
    if (overlay.hidden) return;
    drawSized(trayInk, tray.offsetWidth, tray.offsetHeight, function (p) {
      cutPaper(p, tray.offsetWidth, tray.offsetHeight, { seed: 321, fill: BASE_WASH, grow: 8, jit: 3, strokeWidth: 1.3 });
    }, 14);
  }
  function buildTrayCard(c) {
    var a = el("a", "rcard");
    a.href = "#/card/" + encodeURIComponent(c.id);
    a.setAttribute("aria-label", c.title);

    var ink = svgEl("svg");
    ink.setAttribute("class", "rcard-ink");
    ink.setAttribute("aria-hidden", "true");
    a.appendChild(ink);

    var postit = el("span", "postit");
    var pink = svgEl("svg");
    pink.setAttribute("class", "postit-ink");
    pink.setAttribute("aria-hidden", "true");
    postit.appendChild(pink);
    postit.appendChild(el("span", "postit-text", c.title || "(untitled)"));
    a.appendChild(postit);

    var info = el("span", "rcard-info");
    if (c.source) info.appendChild(el("span", "rc-source", c.source));
    if (c.dateFound) info.appendChild(el("span", "rc-date", c.dateFound));
    a.appendChild(info);
    return a;
  }
  function paintTrayCards() {
    trayCards.querySelectorAll(".rcard").forEach(function (card, idx) {
      var seed = idx * 53 + 17;
      var ink = card.querySelector(".rcard-ink");
      var w = ink.parentNode.offsetWidth, h = ink.parentNode.offsetHeight;
      if (w && h) {
        drawSized(ink, w, h, function (p) {
          cutPaper(p, w, h, { seed: seed, fill: CARD_PAPER, grow: 4, jit: 2, strokeWidth: 1.05 });
        }, 12);
      }
      var pi = card.querySelector(".postit-ink");
      var pw = pi.parentNode.offsetWidth, ph = pi.parentNode.offsetHeight;
      if (pw && ph) {
        drawSized(pi, pw, ph, function (p) {
          cutPaper(p, pw, ph, { seed: seed + 40, fill: KRAFT, grow: 3, jit: 2.4, strokeWidth: 0.9 });
        }, 10);
      }
    });
  }

  // ---------- note page ----------
  function renderNote(id) {
    var card = cardById(id);
    notepage.innerHTML = "";

    var sheet = el("div", "note-sheet");
    var sheetInk = svgEl("svg");
    sheetInk.setAttribute("class", "note-ink");
    sheetInk.setAttribute("aria-hidden", "true");
    sheet.appendChild(sheetInk);

    var inner = el("div", "note-inner");

    var back = el("a", "note-back", t("back"));
    back.href = "#/";
    inner.appendChild(back);

    if (!card) {
      inner.appendChild(el("p", "note-body", "Not found: " + id));
      sheet.appendChild(inner);
      notepage.appendChild(sheet);
      return;
    }

    inner.appendChild(el("h1", "note-title", card.title));
    var squ = svgEl("svg");
    squ.setAttribute("class", "squiggle");
    squ.setAttribute("viewBox", "0 0 600 10");
    squ.setAttribute("preserveAspectRatio", "none");
    squ.setAttribute("aria-hidden", "true");
    inner.appendChild(squ);

    var sub = [];
    if (card.source) sub.push(t("cardSource") + ": " + card.source);
    if (card.dateFound) sub.push(t("cardDate") + ": " + card.dateFound);
    if (sub.length) inner.appendChild(el("p", "note-sub", sub.join("   ·   ")));

    var imgBox = el("div", "note-image" + (card.image ? "" : " is-empty"));
    var imgInk = svgEl("svg");
    imgInk.setAttribute("class", "frame-ink");
    imgInk.setAttribute("aria-hidden", "true");
    imgBox.appendChild(imgInk);
    if (card.image) {
      var im = document.createElement("img");
      im.src = card.image; im.alt = card.title;
      imgBox.appendChild(im);
    } else {
      imgBox.appendChild(el("span", "note-image-label", t("imagePending")));
    }
    inner.appendChild(imgBox);

    inner.appendChild(el("h2", "note-h", t("description")));
    var nf = noteFor(card);
    if (nf.text) {
      if (nf.fallback) inner.appendChild(el("p", "note-fallback", t("fallbackFromFr")));
      inner.appendChild(el("p", "note-body", nf.text));
    } else {
      inner.appendChild(el("p", "note-body is-empty", t("noNote")));
    }

    if (card.tags && card.tags.length) {
      inner.appendChild(el("h2", "note-h", t("relatedTags")));
      var tagRow = el("div", "note-tags");
      card.tags.forEach(function (key) {
        var tl = el("a", "tag-link", drawerLabel(key));
        tl.href = "#/drawer/" + encodeURIComponent(key);
        tagRow.appendChild(tl);
      });
      inner.appendChild(tagRow);
    }

    if (card.sourceUrl) {
      var srcP = el("p", "note-source");
      var sa = el("a", null, t("sourceLink"));
      sa.href = card.sourceUrl;
      sa.target = "_blank";
      sa.rel = "noopener noreferrer";
      srcP.appendChild(sa);
      inner.appendChild(srcP);
    }

    sheet.appendChild(inner);
    notepage.appendChild(sheet);

    paintNote();
  }
  function paintNote() {
    if (notepage.hidden) return;
    var sheet = notepage.querySelector(".note-sheet");
    if (!sheet) return;

    var squ = notepage.querySelector(".squiggle");
    if (squ) {
      drawSized(squ, 600, 10, function (p) {
        p.line(2, 6, 598, 5, { roughness: 2.6, bowing: 2.5, stroke: STROKE, strokeWidth: 1.4, seed: 12 });
      }, 2);
    }
    var img = notepage.querySelector(".note-image");
    var imgInk = notepage.querySelector(".frame-ink");
    if (img && imgInk) {
      drawSized(imgInk, img.clientWidth, img.clientHeight, function (p) {
        cutPaper(p, img.clientWidth, img.clientHeight, {
          seed: 55, fill: "#ece0c6", grow: 2, jit: 2.4, strokeWidth: 1,
        });
      }, 10);
    }
    var sInk = notepage.querySelector(".note-ink");
    if (sInk) {
      drawSized(sInk, sheet.clientWidth, sheet.clientHeight, function (p) {
        cutPaper(p, sheet.clientWidth, sheet.clientHeight, {
          seed: 77, fill: CARD_PAPER, grow: 6, jit: 3, strokeWidth: 1.2,
        });
      }, 14);
    }
  }

  // ---------- routing / view dispatch ----------
  function parseRoute() {
    var raw = (location.hash || "").replace(/^#/, "");
    var parts = raw.split("/").filter(Boolean);
    if (parts[0] === "card" && parts[1]) return { name: "note", id: decodeURIComponent(parts[1]) };
    if (parts[0] === "drawer" && parts[1]) return { name: "drawer", key: decodeURIComponent(parts[1]) };
    return { name: "home" };
  }

  function render() {
    document.documentElement.lang = state.lang;
    if (state.error) {
      notepage.hidden = false;
      room.hidden = true;
      notepage.innerHTML = '<div class="note-sheet"><div class="note-inner"><p class="note-body">Could not load data/cards.json — ' + state.error + "</p></div></div>";
      return;
    }
    if (!state.loaded) return;

    var r = parseRoute();

    if (r.name === "note") {
      closeTray();
      room.hidden = true;
      notepage.hidden = false;
      renderNote(r.id);
      window.scrollTo(0, 0);
      return;
    }

    // home or drawer -> cabinet visible
    notepage.hidden = true;
    notepage.innerHTML = "";
    room.hidden = false;
    fit();

    if (r.name === "drawer" && DRAWERS.indexOf(r.key) !== -1) {
      openDrawer(r.key);
    } else {
      closeTray();
    }
  }

  // ---------- events ----------
  window.addEventListener("hashchange", render);
  window.addEventListener("resize", function () {
    if (!room.hidden) fit();
    if (!overlay.hidden) { paintTray(); paintTrayCards(); }
    if (!notepage.hidden) paintNote();
  });
  window.addEventListener("orientationchange", function () { if (!room.hidden) fit(); });

  overlay.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) location.hash = "#/";
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) location.hash = "#/";
  });

  function drawerButtonFor(key) {
    var all = drawersEl.querySelectorAll(".drawer");
    for (var i = 0; i < all.length; i++) {
      if (all[i].getAttribute("data-drawer") === key) return all[i];
    }
    return null;
  }

  // ---------- boot ----------
  renderLangSwitch();
  buildDrawers();
  paintFrame();
  paintDrawers();
  fit();

  fetch("data/cards.json", { cache: "no-cache" })
    .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
    .then(function (data) {
      state.cards = (data && data.cards) || [];
      state.loaded = true;
      var problems = validate();
      if (problems.length) console.warn("[card-catalog] data issues:\n - " + problems.join("\n - "));
      render();
    })
    .catch(function (err) {
      state.error = String((err && err.message) || err);
      render();
    });

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
      (c.tags || []).forEach(function (tg) { if (!ok[tg]) problems.push(label + ': unknown tag "' + tg + '"'); });
    });
    return problems;
  }
})();
