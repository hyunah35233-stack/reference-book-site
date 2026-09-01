// Stage 2 — cabinet rendering + interaction. Data model unchanged (drawers.js / cards.js).

(function () {
  "use strict";

  var DRAWERS = window.DRAWERS || [];
  var CARDS = window.CARDS || [];

  // --- Same integrity check as stage 1, but console-only here.
  // The full on-page report lives in list.html.
  (function validate() {
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
      if (!c.tags || !c.tags.length) problems.push(label + ": no tags");
      (c.tags || []).forEach(function (t) {
        if (!drawerSet[t]) problems.push(label + ': unknown tag "' + t + '"');
      });
    });
    if (problems.length) {
      console.warn("[card-catalog] data issues:\n - " + problems.join("\n - ") +
        "\nOpen list.html for the full report.");
    }
  })();

  function cardsFor(drawer) {
    return CARDS.filter(function (c) {
      return (c.tags || []).indexOf(drawer) !== -1;
    });
  }

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  // --- Build the 16 drawers ---
  var drawersEl = document.getElementById("drawers");
  DRAWERS.forEach(function (name) {
    var btn = el("button", "drawer");
    btn.type = "button";
    btn.setAttribute("data-drawer", name);
    btn.setAttribute("aria-label", "Open drawer: " + name);

    var face = el("span", "drawer-face");
    var holder = el("span", "label-holder");
    holder.appendChild(el("span", "label-text", name));
    face.appendChild(holder);
    face.appendChild(el("span", "pull"));
    btn.appendChild(face);

    btn.addEventListener("click", function () { openDrawer(name, btn); });
    drawersEl.appendChild(btn);
  });

  // --- Responsive: scale the whole cabinet as one unit, never re-flow ---
  var stage = document.getElementById("stage");
  var cssW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--design-w"));
  var cssH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--design-h"));

  function fit() {
    var margin = window.innerWidth < 640 ? 0.99 : 0.94;
    var scale = Math.min(
      (window.innerWidth * margin) / cssW,
      (window.innerHeight * margin) / cssH,
      1.4
    );
    stage.style.transform = "translate(-50%, -50%) scale(" + scale + ")";
  }
  fit();
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);

  // --- Overlay / open drawer ---
  var overlay = document.getElementById("overlay");
  var trayLabel = document.getElementById("trayLabel");
  var trayCards = document.getElementById("trayCards");
  var openBtn = null;
  var lastFocus = null;

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
      document.getElementById("trayClose").focus();
    }, 170);
  }

  function closeDrawer() {
    overlay.hidden = true;
    if (openBtn) {
      openBtn.classList.remove("is-open");
      openBtn = null;
    }
    if (lastFocus) lastFocus.focus();
  }

  overlay.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) closeDrawer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeDrawer();
  });

  // --- A reference card that flips ---
  function buildCard(c) {
    var card = el("button", "rcard");
    card.type = "button";
    card.setAttribute("data-id", c.id || "");
    card.setAttribute("aria-label", "Reference card: " + (c.title || "untitled") + " (click to flip)");

    var inner = el("span", "rcard-inner");

    // Front
    var front = el("span", "rcard-front");
    var postit = el("span", "postit");
    postit.appendChild(el("span", "postit-text", c.title || "(untitled)"));
    front.appendChild(postit);
    front.appendChild(el("span", "rcard-hint", "flip"));

    // Back
    var back = el("span", "rcard-back");
    var media = el("span", "rcard-media");
    if (c.image) {
      var img = document.createElement("img");
      img.src = c.image;
      img.alt = c.title || "";
      img.loading = "lazy";
      media.appendChild(img);
    } else {
      media.appendChild(el("span", "noimg", "no image"));
    }
    back.appendChild(media);

    var fields = el("span", "rcard-fields");
    if (c.source) {
      var s = el("span", "rc-line rc-source");
      s.appendChild(el("span", "rc-key", "Source"));
      s.appendChild(document.createTextNode(c.source));
      fields.appendChild(s);
    }
    if (c.note) {
      var n = el("span", "rc-line rc-note");
      n.appendChild(el("span", "rc-key", "Note"));
      n.appendChild(document.createTextNode(c.note));
      fields.appendChild(n);
    }
    if (c.tags && c.tags.length) {
      var t = el("span", "rc-line");
      t.appendChild(el("span", "rc-key", "Also filed under"));
      var tagWrap = el("span", "rc-tags");
      c.tags.forEach(function (tag) {
        var tb = el("button", "rc-tag", tag);
        tb.type = "button";
        tb.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var target = drawerButtonFor(tag);
          if (target) {
            closeDrawer();
            window.setTimeout(function () { openDrawer(tag, target); }, 120);
          }
        });
        tagWrap.appendChild(tb);
      });
      t.appendChild(tagWrap);
      fields.appendChild(t);
    }
    back.appendChild(fields);

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);

    card.addEventListener("click", function () {
      card.classList.toggle("is-flipped");
    });
    return card;
  }

  function drawerButtonFor(name) {
    var all = drawersEl.querySelectorAll(".drawer");
    for (var i = 0; i < all.length; i++) {
      if (all[i].getAttribute("data-drawer") === name) return all[i];
    }
    return null;
  }
})();
