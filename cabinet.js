// Stage 2 — hand-drawn, cut-paper card catalog. Wood-tone palette. rough.js ink.

(function () {
  "use strict";

  var DRAWERS = window.DRAWERS || [];
  var CARDS = window.CARDS || [];
  var R = window.rough || null;
  if (!R) document.body.classList.add("no-ink");

  // --- design grid constants (must match cabinet.css) ---
  var CW = 1001, CH = 635, DW = 223, DH = 132, GAP = 18;
  var PADX = (CW - (DW * 4 + GAP * 3)) / 2;
  var PADY = (CH - (DH * 4 + GAP * 3)) / 2;

  // --- palette: one warm wood-tone family, layered like cut paper ---
  var STROKE = "#4b3c2b";
  var STROKE_LT = "#9c8663";
  var BASE_WASH = "#c9b083";       // the catalogue board (darkest layer)
  var PENCIL = "#ac8a5c";          // wood-brown pencil for hatching
  var LABEL_SLIP = "#f7f0dd";      // label paper (lightest)
  var KRAFT = "#dcc59a";
  var CARD_PAPER = "#f6eeda";
  var PAPER_TONES = [               // the cut-out drawer papers (mid layer)
    "#e8d9b8", "#e4d3b0", "#ecddbe", "#e1d0a9",
    "#e7d7b5", "#e2d1ab", "#eadcbb", "#ded0a4",
  ];

  // ---- integrity check (console only; full report in list.html) ----
  (function validate() {
    var problems = [], seen = {}, ok = {};
    DRAWERS.forEach(function (d) { ok[d] = true; });
    CARDS.forEach(function (c, i) {
      var label = c.id || c.title || "card #" + (i + 1);
      if (!c.id) problems.push(label + ": missing id");
      if (c.id && seen[c.id]) problems.push(label + ": duplicate id");
      if (c.id) seen[c.id] = true;
      if (!c.title) problems.push(label + ": missing title");
      if (!c.tags || !c.tags.length) problems.push(label + ": no tags");
      (c.tags || []).forEach(function (t) {
        if (!ok[t]) problems.push(label + ': unknown tag "' + t + '"');
      });
    });
    if (problems.length) {
      console.warn("[card-catalog] data issues:\n - " + problems.join("\n - ") +
        "\nOpen list.html for the full report.");
    }
  })();

  function cardsFor(drawer) {
    return CARDS.filter(function (c) { return (c.tags || []).indexOf(drawer) !== -1; });
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag) {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---- rough.js wrapper (rough.svg() returns nodes we must append) ----
  function pen(svg) {
    var rc = R ? R.svg(svg) : null;
    return {
      rect: function (x, y, w, h, o) { if (rc) svg.appendChild(rc.rectangle(x, y, w, h, o)); },
      line: function (x1, y1, x2, y2, o) { if (rc) svg.appendChild(rc.line(x1, y1, x2, y2, o)); },
      poly: function (pts, o) { if (rc) svg.appendChild(rc.polygon(pts, o)); },
      path: function (d, o) { if (rc) svg.appendChild(rc.path(d, o)); },
    };
  }
  function drawSized(svg, w, h, cb, pad) {
    pad = pad || 12;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", -pad + " " + -pad + " " + (w + pad * 2) + " " + (h + pad * 2));
    if (!R) return;
    cb(pen(svg), w, h);
  }

  // A slightly irregular, hand-cut paper outline (deckled edge).
  function cutPoints(w, h, grow, jit, r) {
    var g = grow, out = [];
    var corners = [[-g, -g], [w + g, -g], [w + g, h + g], [-g, h + g]];
    for (var e = 0; e < 4; e++) {
      var a = corners[e], b = corners[(e + 1) % 4];
      for (var s = 0; s < 3; s++) {
        var t = s / 3;
        out.push([
          a[0] + (b[0] - a[0]) * t + (r() * 2 - 1) * jit,
          a[1] + (b[1] - a[1]) * t + (r() * 2 - 1) * jit,
        ]);
      }
    }
    return out;
  }
  // A hand-cut piece of paper: solid tone + a wood-brown pencil hatch on top
  // whose strokes drift past the torn edge, then the ink outline.
  function cutPaper(p, w, h, opts) {
    var r = rng(opts.seed);
    var grow = opts.grow != null ? opts.grow : 5;
    var jit = opts.jit != null ? opts.jit : 2.6;
    // base tone
    p.poly(cutPoints(w, h, grow, jit, rng(opts.seed)), {
      fill: opts.fill, fillStyle: "solid", fillWeight: 2,
      stroke: "none", roughness: 1.4, bowing: 1, seed: opts.seed + 3,
    });
    // coloured-pencil hatch, slightly oversized so colour bleeds out
    if (opts.hatch) {
      p.poly(cutPoints(w, h, grow + 3, jit, rng(opts.seed + 1)), {
        fill: opts.hatch, fillStyle: "hachure",
        hachureAngle: opts.angle != null ? opts.angle : (-38 + r() * 76),
        hachureGap: 5.4 + r() * 2, fillWeight: 0.8 + r() * 0.35,
        stroke: "none", roughness: 2, bowing: 1.4, seed: opts.seed + 9,
      });
    }
    // torn-edge outline, retraced twice
    for (var i = 0; i < 2; i++) {
      p.poly(cutPoints(w, h, grow, jit, rng(opts.seed + 20 + i)), {
        fill: "none", stroke: opts.stroke || STROKE,
        strokeWidth: (opts.strokeWidth || 1) + (i ? 0 : 0.3),
        roughness: 1.5, bowing: 1, seed: opts.seed + 30 + i,
      });
    }
  }

  // ---- build the 16 drawers ----------------------------------------
  var drawersEl = document.getElementById("drawers");
  DRAWERS.forEach(function (name, idx) {
    var btn = el("button", "drawer");
    btn.type = "button";
    btn.setAttribute("data-drawer", name);
    btn.setAttribute("aria-label", "Open drawer: " + name);
    var rot = rng(idx * 71 + 9);
    btn.style.setProperty("--rot", (rot() * 4.4 - 2.2).toFixed(2) + "deg");

    var ink = svgEl("svg");
    ink.setAttribute("class", "drawer-ink");
    btn.appendChild(ink);

    var lab = el("span", "drawer-label", name);
    lab.style.setProperty("--tilt", (rot() * 3 - 1.5).toFixed(2) + "deg");
    btn.appendChild(lab);

    btn.addEventListener("click", function () { openDrawer(name, btn); });
    drawersEl.appendChild(btn);
  });

  function paintDrawers() {
    drawersEl.querySelectorAll(".drawer").forEach(function (btn, idx) {
      var ink = btn.querySelector(".drawer-ink");
      var w = btn.offsetWidth, h = btn.offsetHeight;
      if (!w || !h) return;
      var seed = idx * 137 + 11;
      var paper = PAPER_TONES[idx % PAPER_TONES.length];
      drawSized(ink, w, h, function (p) {
        var r = rng(seed + 5);
        // the drawer = one hand-cut piece of paper, wood-pencil shaded, glued on
        cutPaper(p, w, h, {
          seed: seed, fill: paper, hatch: PENCIL, grow: -1, jit: 3,
        });
        // the label slip — a smaller, lighter scrap of paper on top
        var lw = w * 0.66, lh = 42;
        var lx = w / 2 - lw / 2 + (r() * 5 - 2.5);
        var ly = h / 2 - lh / 2 + (r() * 4 - 2);
        p.rect(lx, ly, lw, lh, {
          roughness: 1.7, bowing: 1.4, stroke: STROKE, strokeWidth: 0.85,
          fill: LABEL_SLIP, fillStyle: "solid", seed: seed + 31,
        });
        // a small hand-drawn knob
        var cx = w / 2 + (r() * 8 - 4), cy = h - 22 - r() * 3;
        p.rect(cx - 15, cy - 4, 30, 9, {
          roughness: 2, bowing: 2, stroke: STROKE, strokeWidth: 1,
          fill: PENCIL, fillStyle: "hachure", hachureGap: 3, fillWeight: 0.9, seed: seed + 21,
        });
      }, 16);
    });
  }

  // ---- the base cabinet (paper-art ground layer) -------------------
  var frame = document.getElementById("cabinetFrame");
  function paintFrame() {
    while (frame.firstChild) frame.removeChild(frame.firstChild);
    frame.setAttribute("viewBox", "-18 -18 " + (CW + 36) + " " + (CH + 36));
    if (!R) return;
    var p = pen(frame);
    var r = rng(999);
    // base sheet
    cutPaper(p, CW, CH, { seed: 900, fill: BASE_WASH, grow: 10, jit: 3.2, strokeWidth: 1.4 });
    // interior 4x4 divisions, drawn lightly — the catalogue behind the paper
    for (var i = 1; i <= 3; i++) {
      var x = PADX + i * (DW + GAP) - GAP / 2;
      p.line(x, 12, x + (r() * 4 - 2), CH - 12, { roughness: 2.6, bowing: 1.5, stroke: STROKE_LT, strokeWidth: 0.8, seed: 100 + i });
      var y = PADY + i * (DH + GAP) - GAP / 2;
      p.line(12, y, CW - 12, y + (r() * 4 - 2), { roughness: 2.6, bowing: 1.5, stroke: STROKE_LT, strokeWidth: 0.8, seed: 200 + i });
    }
    // lid seam near the top
    p.line(6, 16, CW - 6, 16 + r() * 4, { roughness: 2.4, bowing: 2, stroke: STROKE, strokeWidth: 1, seed: 73 });
  }

  // ---- responsive: scale the whole cabinet, never re-flow ---------
  var stage = document.getElementById("stage");
  var cssW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--design-w"));
  var cssH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--design-h"));
  function fit() {
    var m = window.innerWidth < 640 ? 0.98 : 0.92;
    var s = Math.min((window.innerWidth * m) / cssW, (window.innerHeight * m) / cssH, 1.35);
    stage.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  }

  paintFrame();
  paintDrawers();
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);

  // ---- open drawer / overlay -------------------------------------
  var overlay = document.getElementById("overlay");
  var trayLabel = document.getElementById("trayLabel");
  var trayCards = document.getElementById("trayCards");
  var trayInk = document.getElementById("trayInk");
  var tray = overlay.querySelector(".tray");
  var openBtn = null, lastFocus = null;

  function openDrawer(name, btn) {
    if (openBtn) openBtn.classList.remove("is-open");
    openBtn = btn;
    lastFocus = btn;
    btn.classList.add("is-open");

    trayLabel.textContent = name;
    trayCards.innerHTML = "";
    var list = cardsFor(name);
    if (!list.length) {
      trayCards.appendChild(el("p", "tray-empty", "This drawer is empty."));
    } else {
      list.forEach(function (c) { trayCards.appendChild(buildCard(c)); });
    }
    window.setTimeout(function () {
      overlay.hidden = false;
      paintTray();
      paintCards();
      document.getElementById("trayClose").focus();
    }, 140);
  }
  function closeDrawer() {
    overlay.hidden = true;
    if (openBtn) { openBtn.classList.remove("is-open"); openBtn = null; }
    if (lastFocus) lastFocus.focus();
  }

  function paintTray() {
    if (overlay.hidden) return;
    var w = tray.offsetWidth, h = tray.offsetHeight;
    drawSized(trayInk, w, h, function (p) {
      cutPaper(p, w, h, { seed: 321, fill: BASE_WASH, grow: 8, jit: 3, strokeWidth: 1.3 });
    }, 14);
  }
  function paintCards() {
    trayCards.querySelectorAll(".rcard").forEach(function (card, idx) {
      var seed = idx * 53 + 17;
      card.querySelectorAll(".rcard-ink").forEach(function (ink, k) {
        var host = ink.parentNode;
        var w = host.offsetWidth, h = host.offsetHeight;
        if (!w || !h) return;
        drawSized(ink, w, h, function (p) {
          cutPaper(p, w, h, { seed: seed + k * 9, fill: CARD_PAPER, grow: 4, jit: 2, strokeWidth: 1.05 });
          if (k === 0) {
            // hand-ruled lines on the index-card front
            var rr = rng(seed + 61);
            for (var ln = 0; ln < 6; ln++) {
              var ly = 96 + ln * 30 + (rr() * 3 - 1.5);
              if (ly > h - 14) break;
              p.line(16, ly, w - 14, ly + (rr() * 3 - 1.5), {
                roughness: 2.4, bowing: 1.2, stroke: "#8aa0bf", strokeWidth: 0.7, seed: seed + ln,
              });
            }
          }
        }, 12);
      });
      var pi = card.querySelector(".postit-ink");
      if (pi) {
        var host = pi.parentNode;
        var w = host.offsetWidth, h = host.offsetHeight;
        drawSized(pi, w, h, function (p) {
          cutPaper(p, w, h, { seed: seed + 40, fill: KRAFT, grow: 3, jit: 2.4, strokeWidth: 0.9 });
        }, 10);
      }
    });
  }

  window.addEventListener("resize", function () {
    if (!overlay.hidden) { paintTray(); paintCards(); }
  });
  overlay.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeDrawer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeDrawer();
  });

  // ---- a reference card that flips ------------------------------
  function buildCard(c) {
    var card = el("button", "rcard");
    card.type = "button";
    card.setAttribute("data-id", c.id || "");
    card.setAttribute("aria-label", "Reference card: " + (c.title || "untitled") + " (click to flip)");

    var inner = el("span", "rcard-inner");

    var front = el("span", "rcard-face rcard-front");
    front.appendChild(svgFace());
    var postit = el("span", "postit");
    var pink = svgEl("svg");
    pink.setAttribute("class", "postit-ink");
    postit.appendChild(pink);
    postit.appendChild(el("span", "postit-text", c.title || "(untitled)"));
    front.appendChild(postit);
    front.appendChild(el("span", "rcard-hint", "flip"));

    var back = el("span", "rcard-face rcard-back");
    back.appendChild(svgFace());
    var media = el("span", "rcard-media");
    if (c.image) {
      var img = document.createElement("img");
      img.src = c.image; img.alt = c.title || ""; img.loading = "lazy";
      media.appendChild(img);
    } else {
      media.appendChild(el("span", "noimg", "no image"));
    }
    back.appendChild(media);

    var fields = el("span", "rcard-fields");
    if (c.source) {
      var s = el("span", "rc-line");
      s.appendChild(el("span", "rc-key", "Source"));
      s.appendChild(document.createTextNode(c.source));
      fields.appendChild(s);
    }
    if (c.note) {
      var n = el("span", "rc-line");
      n.appendChild(el("span", "rc-key", "Note"));
      n.appendChild(document.createTextNode(c.note));
      fields.appendChild(n);
    }
    if (c.tags && c.tags.length) {
      var t = el("span", "rc-line");
      t.appendChild(el("span", "rc-key", "Also filed under"));
      var wrap = el("span", "rc-tags");
      c.tags.forEach(function (tag) {
        var tb = el("button", "rc-tag", tag);
        tb.type = "button";
        tb.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var target = drawerButtonFor(tag);
          if (target) {
            closeDrawer();
            window.setTimeout(function () { openDrawer(tag, target); }, 110);
          }
        });
        wrap.appendChild(tb);
      });
      t.appendChild(wrap);
      fields.appendChild(t);
    }
    back.appendChild(fields);

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    card.addEventListener("click", function () { card.classList.toggle("is-flipped"); });
    return card;
  }
  function svgFace() {
    var s = svgEl("svg");
    s.setAttribute("class", "rcard-ink");
    return s;
  }
  function drawerButtonFor(name) {
    var all = drawersEl.querySelectorAll(".drawer");
    for (var i = 0; i < all.length; i++) {
      if (all[i].getAttribute("data-drawer") === name) return all[i];
    }
    return null;
  }
})();
