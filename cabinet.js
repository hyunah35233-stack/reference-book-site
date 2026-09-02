// Stage 2 — hand-drawn cabinet. rough.js for the wobbly ink; data model unchanged.

(function () {
  "use strict";

  var DRAWERS = window.DRAWERS || [];
  var CARDS = window.CARDS || [];
  var R = window.rough || null;
  if (!R) document.body.classList.add("no-ink");

  // Graphite + a soft coloured-pencil palette, cycled per drawer.
  var STROKE = "#46413c";
  var LABEL_CARD = "#faf7ef";
  var PENCILS = [
    "#d7c7a9", "#b8cace", "#ddc4bb", "#c6d1b5",
    "#e7d3a0", "#cbc0da", "#d9c8b1", "#b4c8be",
  ];

  // ---- integrity check (console only; full report lives in list.html) ----
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

  // Deterministic tiny PRNG so every reload draws the same wobble.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---- rough.js helpers -------------------------------------------------
  // rough.svg() returns nodes that must be appended by hand — wrap that.
  function pen(svg) {
    var rc = R ? R.svg(svg) : null;
    return {
      rect: function (x, y, w, h, o) { if (rc) svg.appendChild(rc.rectangle(x, y, w, h, o)); },
      line: function (x1, y1, x2, y2, o) { if (rc) svg.appendChild(rc.line(x1, y1, x2, y2, o)); },
      ellipse: function (x, y, w, h, o) { if (rc) svg.appendChild(rc.ellipse(x, y, w, h, o)); },
    };
  }

  function drawSized(svg, w, h, cb, pad) {
    pad = pad || 10;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", -pad + " " + -pad + " " + (w + pad * 2) + " " + (h + pad * 2));
    if (!R) return;
    cb(pen(svg), w, h);
  }

  function sketchBox(p, w, h, opts) {
    opts = opts || {};
    var seed = opts.seed || 1;
    var r = rng(seed);
    // coloured-pencil fill, nudged so colour drifts past the outline
    if (opts.fill) {
      p.rect(
        -3 - r() * 4, -2 - r() * 4,
        w + 6 + r() * 6, h + 5 + r() * 6,
        {
          roughness: 2,
          bowing: 1.4,
          stroke: "none",
          fill: opts.fill,
          fillStyle: "hachure",
          hachureAngle: opts.angle != null ? opts.angle : (-40 + r() * 80),
          hachureGap: 5.4 + r() * 2.4,
          fillWeight: 0.9 + r() * 0.45,
          seed: seed + 7,
        }
      );
    }
    // the ink outline, drawn twice for a re-traced look
    for (var i = 0; i < 2; i++) {
      p.rect(r() * 1.5, r() * 1.5, w - r() * 2, h - r() * 2, {
        roughness: 1.9,
        bowing: 1.6,
        stroke: STROKE,
        strokeWidth: 1.15 + (i ? 0 : 0.35),
        fill: "none",
        seed: seed + i * 13,
      });
    }
  }

  // ---- build 16 drawers ----------------------------------------------
  var drawersEl = document.getElementById("drawers");

  DRAWERS.forEach(function (name, idx) {
    var btn = el("button", "drawer");
    btn.type = "button";
    btn.setAttribute("data-drawer", name);
    btn.setAttribute("aria-label", "Open drawer: " + name);

    var ink = svgEl("svg");
    ink.setAttribute("class", "drawer-ink");
    btn.appendChild(ink);

    var lab = el("span", "drawer-label", name);
    var tiltR = rng(idx * 91 + 5);
    lab.style.setProperty("--tilt", (-2.4 + tiltR() * 4.4).toFixed(2) + "deg");
    btn.appendChild(lab);

    btn.addEventListener("click", function () { openDrawer(name, btn); });
    drawersEl.appendChild(btn);
  });

  function paintDrawers() {
    var btns = drawersEl.querySelectorAll(".drawer");
    btns.forEach(function (btn, idx) {
      var ink = btn.querySelector(".drawer-ink");
      var w = btn.offsetWidth, h = btn.offsetHeight;
      if (!w || !h) return;
      var seed = idx * 137 + 11;
      var pencil = PENCILS[idx % PENCILS.length];
      drawSized(ink, w, h, function (p) {
        sketchBox(p, w, h, { seed: seed, fill: pencil });
        var r = rng(seed + 3);
        // a label card behind the handwriting, like the real catalogue slip
        var lw = w * 0.74, lh = 46;
        p.rect(w / 2 - lw / 2 + (r() * 5 - 2.5), h / 2 - lh / 2 + (r() * 4 - 2),
          lw, lh, {
            roughness: 1.8, bowing: 1.5, stroke: STROKE, strokeWidth: 0.9,
            fill: LABEL_CARD, fillStyle: "solid", seed: seed + 31,
          });
        // a little knob, hand-drawn, near the bottom centre
        var cx = w / 2 + (r() * 8 - 4);
        var cy = h - 16 - r() * 4;
        p.rect(cx - 15, cy - 4, 30, 9, {
          roughness: 2.1, bowing: 2, stroke: STROKE, strokeWidth: 1.1,
          fill: pencil, fillStyle: "hachure", hachureGap: 3, fillWeight: 1,
          seed: seed + 21,
        });
      }, 12);
    });
  }

  // ---- cabinet frame -------------------------------------------------
  var frame = document.getElementById("cabinetFrame");
  function paintFrame() {
    var W = 1001, H = 635;
    while (frame.firstChild) frame.removeChild(frame.firstChild);
    frame.setAttribute("viewBox", "-16 -16 " + (W + 32) + " " + (H + 32));
    if (!R) return;
    var p = pen(frame);
    var r = rng(999);
    for (var i = 0; i < 2; i++) {
      p.rect(-6 + r() * 3, -6 + r() * 3, W + 12 - r() * 4, H + 12 - r() * 4, {
        roughness: 2.2, bowing: 1.4, stroke: STROKE,
        strokeWidth: 1.4 + (i ? 0 : 0.4), fill: "none", seed: 41 + i * 17,
      });
    }
    // a second line inside the top edge, like a lid seam
    p.line(4, 16, W - 4, 16 + r() * 4, {
      roughness: 2.4, bowing: 2, stroke: STROKE, strokeWidth: 1, seed: 73,
    });
  }

  // ---- responsive: scale the whole cabinet, never re-flow ----------
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

  // ---- open drawer / overlay ---------------------------------------
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
    }, 150);
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
      var r = rng(321);
      for (var i = 0; i < 2; i++) {
        p.rect(-4 + r() * 3, -4 + r() * 3, w + 8 - r() * 4, h + 8 - r() * 4, {
          roughness: 2.1, bowing: 1.3, stroke: STROKE,
          strokeWidth: 1.3 + (i ? 0 : 0.4), fill: "none", seed: 55 + i * 19,
        });
      }
    }, 12);
  }

  function paintCards() {
    trayCards.querySelectorAll(".rcard").forEach(function (card, idx) {
      var seed = idx * 53 + 17;
      card.querySelectorAll(".rcard-ink").forEach(function (ink, k) {
        var host = ink.parentNode;
        var w = host.offsetWidth, h = host.offsetHeight;
        if (!w || !h) return;
        drawSized(ink, w, h, function (p) {
          var r = rng(seed + k * 5);
          for (var i = 0; i < 2; i++) {
            p.rect(r() * 2, r() * 2, w - r() * 3, h - r() * 3, {
              roughness: 1.7, bowing: 1.3, stroke: STROKE,
              strokeWidth: 1.1 + (i ? 0 : 0.3), fill: "none", seed: seed + i * 11 + k * 3,
            });
          }
        }, 10);
      });
      var pi = card.querySelector(".postit-ink");
      if (pi) {
        var host = pi.parentNode;
        var w = host.offsetWidth, h = host.offsetHeight;
        drawSized(pi, w, h, function (p) {
          sketchBox(p, w, h, { seed: seed + 40, fill: "#f6e79a", angle: 12 });
        }, 8);
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

  // ---- a reference card that flips --------------------------------
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
