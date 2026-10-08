/* grid.js
   Draws the warehouse floor as a grid of cells inside a scrollable
   viewport, and handles the placement toolbar modes (select, place rack,
   place pallet, erase), zoom, and click-and-drag panning.

   Layout: #mapScroll (the viewport, capped to the window height, scrolls
   both ways) contains #warehouseGrid. The grid has a sticky header row
   (A, B, C...) and a sticky header column (1, 2, 3...) so you keep your
   bearings while scrolling a big warehouse. Cells are a fixed pixel size
   set by the zoom level, so zooming out is what makes a big grid fit. */

var Grid = (function () {
  "use strict";

  var BASE_CELL = 64;     // cell size in px at 100% zoom
  var GAP = 3;            // px between cells
  var HDR_W = 30;         // row-header column width, px
  var HDR_H = 20;         // column-header row height, px
  var PAN_THRESHOLD = 5;  // px of mouse movement before a press becomes a drag
  var MIN_VIEWPORT_H = 280;     // never let the map viewport get shorter than this, px
  var VIEWPORT_BOTTOM_GAP = 40; // room kept below the viewport: panel padding + page margin, px

  var mode = "select";
  var rackTwoSided = false;
  var container = null;   // .grid
  var scroller = null;    // .map-scroll
  var onOpenSection = function () {};
  var swallowNextClick = false;
  var foundIds = {};      // sections marked by the latest search; kept until the next search

  function init(gridEl, scrollEl, openSectionCallback) {
    container = gridEl;
    scroller = scrollEl;
    onOpenSection = openSectionCallback;
    scroller.style.setProperty("--gap", GAP + "px");
    scroller.style.setProperty("--hdr-w", HDR_W + "px");
    scroller.style.setProperty("--hdr-h", HDR_H + "px");
    container.addEventListener("click", handleClick);
    initPanning();
    render();
    initViewportSizing();
  }

  /* ---------- keeping the viewport on screen ---------- */

  // Caps the map viewport so its bottom edge (and the horizontal scrollbar
  // that lives there) stays inside the window. It's measured from where the
  // viewport actually starts, so it stays correct when the header or toolbar
  // wraps onto extra lines on narrower screens. CSS has a rough fallback.
  function sizeViewport() {
    var top = scroller.getBoundingClientRect().top + window.pageYOffset;
    var available = Math.floor(window.innerHeight - top - VIEWPORT_BOTTOM_GAP);
    scroller.style.maxHeight = Math.max(MIN_VIEWPORT_H, available) + "px";
  }

  function initViewportSizing() {
    sizeViewport();
    window.addEventListener("resize", sizeViewport);
    window.addEventListener("load", sizeViewport);
    // anything above the map changing height (fonts loading, the toolbar
    // gaining the rack-type toggle and wrapping) shifts the map down
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(sizeViewport).observe(document.body);
    }
  }

  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll("[data-mode-btn]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-mode-btn") === newMode);
    });
    container.classList.toggle("is-erasing", newMode === "erase");
    container.classList.toggle("is-placing", newMode === "rack" || newMode === "pallet");
  }

  // Whether newly placed racks get a Left and a Right side.
  function setRackSides(twoSided) {
    rackTwoSided = !!twoSided;
  }

  /* ---------- rendering ---------- */

  function cellPx() {
    return Math.max(6, Math.round(BASE_CELL * Store.getMeta().zoom / 100));
  }

  function applyZoom() {
    var meta = Store.getMeta();
    var px = cellPx();
    container.style.setProperty("--cols", String(meta.cols));
    container.style.setProperty("--rows", String(meta.rows));
    container.style.setProperty("--cell", px + "px");
    // Below these sizes there isn't room for the icon / label / badge.
    container.classList.toggle("grid--compact", px < 40);
    container.classList.toggle("grid--tiny", px < 28);
  }

  function headerCell(className, text) {
    var el = document.createElement("div");
    el.className = className;
    el.textContent = text;
    return el;
  }

  function render() {
    var meta = Store.getMeta();
    applyZoom();
    container.innerHTML = "";
    var frag = document.createDocumentFragment();
    frag.appendChild(headerCell("grid__corner", ""));
    for (var c = 0; c < meta.cols; c++) {
      frag.appendChild(headerCell("grid__hdr grid__hdr--col", Store.colLabel(c)));
    }
    for (var r = 0; r < meta.rows; r++) {
      frag.appendChild(headerCell("grid__hdr grid__hdr--row", String(r + 1)));
      for (c = 0; c < meta.cols; c++) {
        frag.appendChild(buildCell(r, c));
      }
    }
    container.appendChild(frag);
  }

  function buildCell(row, col) {
    var section = Store.getCell(row, col);
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cell cell--empty";
    btn.setAttribute("data-row", row);
    btn.setAttribute("data-col", col);
    btn.setAttribute("data-cell", "1");

    if (section) {
      var count = Store.sectionProductCount(section);
      var twoSided = section.type === "rack" && !!section.twoSided;
      btn.className = "cell cell--" + section.type +
        (twoSided ? " cell--rack2" : "") +                                   // divider shows when zoomed far out
        (section.type === "rack" && count === 0 ? " cell--unstocked" : "") + // a rack with nothing on it yet
        (foundIds[section.id] ? " cell--found" : "");
      btn.setAttribute("data-section-id", section.id);

      // Product-count badges. A two-sided rack gets one per side, in the
      // matching top corner, showing just that side's products.
      var badges = "";
      var sideNote = "";
      if (twoSided) {
        var left = Store.sideProductCount(section.id, "left");
        var right = Store.sideProductCount(section.id, "right");
        if (left > 0) badges += '<span class="cell__count cell__count--left" title="Left side: ' + left + '">' + left + "</span>";
        if (right > 0) badges += '<span class="cell__count cell__count--right" title="Right side: ' + right + '">' + right + "</span>";
        if (count > 0) sideNote = " (left " + left + ", right " + right + ")";
      } else if (count > 0) {
        badges = '<span class="cell__count">' + count + "</span>";
      }
      btn.innerHTML =
        '<span class="cell__icon" aria-hidden="true">' + sectionIcon(section.type, twoSided) + "</span>" +
        '<span class="cell__label">' + escapeHTML(section.label) + "</span>" + badges;
      var kind = section.type === "pallet" ? "Pallet " : (twoSided ? "Two-sided rack " : "Rack ");
      btn.setAttribute("aria-label", kind + section.label + ", " + count + (count === 1 ? " item" : " items") + sideNote +
        (foundIds[section.id] ? MATCH_NOTE : ""));
    } else {
      btn.innerHTML = '<span class="cell__plus" aria-hidden="true">+</span>';
      btn.setAttribute("aria-label", "Empty section, row " + (row + 1) + " column " + (col + 1));
    }
    return btn;
  }

  function sectionIcon(type, twoSided) {
    if (type === "rack") {
      // two-sided racks get a centre divider: two columns of shelves
      var divider = twoSided
        ? '<line x1="16" y1="4" x2="16" y2="28" stroke="currentColor" stroke-width="2"/>'
        : "";
      return '<svg viewBox="0 0 32 32" class="icon-rack"><rect x="4" y="4" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"/><line x1="4" y1="12" x2="28" y2="12" stroke="currentColor" stroke-width="2"/><line x1="4" y1="20" x2="28" y2="20" stroke="currentColor" stroke-width="2"/>' + divider + "</svg>";
    }
    return '<svg viewBox="0 0 32 32" class="icon-pallet"><rect x="3" y="18" width="26" height="5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="23" x2="3" y2="27" stroke="currentColor" stroke-width="2"/><line x1="11" y1="23" x2="11" y2="27" stroke="currentColor" stroke-width="2"/><line x1="21" y1="23" x2="21" y2="27" stroke="currentColor" stroke-width="2"/><line x1="29" y1="23" x2="29" y2="27" stroke="currentColor" stroke-width="2"/><line x1="6" y1="9" x2="26" y2="9" stroke="currentColor" stroke-width="2"/><line x1="6" y1="14" x2="26" y2="14" stroke="currentColor" stroke-width="2"/></svg>';
  }

  /* ---------- clicks ---------- */

  function handleClick(e) {
    var cell = e.target.closest("[data-cell]");
    if (!cell) return;
    var row = parseInt(cell.getAttribute("data-row"), 10);
    var col = parseInt(cell.getAttribute("data-col"), 10);
    var sectionId = cell.getAttribute("data-section-id");

    if (mode === "select") {
      if (sectionId) onOpenSection(sectionId);
      return;
    }
    if (mode === "rack" || mode === "pallet") {
      if (sectionId) { flash(cell); return; }
      Store.addSection(row, col, mode, { twoSided: mode === "rack" && rackTwoSided });
      render();
      return;
    }
    if (mode === "erase") {
      if (!sectionId) return;
      var section = Store.sections[sectionId];
      var count = Store.sectionProductCount(section);
      var msg = count > 0
        ? "Remove " + (section.type === "rack" ? "rack " : "pallet ") + section.label + " and its " + count + " stored product" + (count === 1 ? "" : "s") + "?"
        : "Remove " + (section.type === "rack" ? "rack " : "pallet ") + section.label + "?";
      if (window.confirm(msg)) {
        Store.deleteSection(sectionId);
        render();
      }
    }
  }

  function flash(el) {
    el.classList.add("cell--flash");
    setTimeout(function () { el.classList.remove("cell--flash"); }, 350);
  }

  /* ---------- zoom ---------- */

  // Sets the zoom (percent), keeping whatever is at the centre of the
  // viewport where it is. Returns the zoom actually applied (it's clamped).
  function setZoom(percent) {
    var cx = 0.5, cy = 0.5;
    if (scroller.scrollWidth > 0 && scroller.scrollHeight > 0) {
      cx = (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth;
      cy = (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight;
    }
    var zoom = Store.setZoom(percent);
    applyZoom();
    scroller.scrollLeft = cx * scroller.scrollWidth - scroller.clientWidth / 2;
    scroller.scrollTop = cy * scroller.scrollHeight - scroller.clientHeight / 2;
    return zoom;
  }

  // Picks the largest zoom at which the whole grid fits in the viewport.
  // Height comes from the viewport's CSS max-height rather than its current
  // height, so pressing Fit twice gives the same answer.
  function fitToView() {
    var meta = Store.getMeta();
    var availW = scroller.clientWidth;
    var maxH = parseFloat(window.getComputedStyle(scroller).maxHeight);
    if (!isFinite(maxH)) maxH = Math.max(320, window.innerHeight - 250);
    var availH = maxH - 2; // the viewport's 1px top and bottom borders
    if (availW <= 0 || availH <= 0) return meta.zoom;
    var perW = (availW - HDR_W - GAP - 6) / meta.cols - GAP;
    var perH = (availH - HDR_H - GAP - 6) / meta.rows - GAP;
    var px = Math.floor(Math.min(perW, perH));
    return setZoom(Math.floor(px / BASE_CELL * 100));
  }

  /* ---------- click-and-drag panning ---------- */

  // Mouse only: touch screens already pan by dragging. A press only turns
  // into a drag after PAN_THRESHOLD px of movement, so ordinary clicks on
  // cells still work, and the click that ends a drag is swallowed so
  // panning can never open, place or erase anything.
  function initPanning() {
    var start = null;
    var dragging = false;

    scroller.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      // a press on the scrollbar itself is left to the browser. Empty space
      // beside a narrow grid also targets the scroller but is inside
      // clientWidth/clientHeight, so it can still start a pan.
      if (e.target === scroller && (e.offsetX >= scroller.clientWidth || e.offsetY >= scroller.clientHeight)) return;
      start = { x: e.clientX, y: e.clientY, left: scroller.scrollLeft, top: scroller.scrollTop, id: e.pointerId };
      dragging = false;
    });

    scroller.addEventListener("pointermove", function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) < PAN_THRESHOLD && Math.abs(dy) < PAN_THRESHOLD) return;
        dragging = true;
        scroller.classList.add("is-panning");
        try { scroller.setPointerCapture(start.id); } catch (err) { /* not supported */ }
      }
      scroller.scrollLeft = start.left - dx;
      scroller.scrollTop = start.top - dy;
    });

    function endPan() {
      if (!start) return;
      if (dragging) {
        swallowNextClick = true;
        setTimeout(function () { swallowNextClick = false; }, 0);
        scroller.classList.remove("is-panning");
      }
      start = null;
      dragging = false;
    }
    scroller.addEventListener("pointerup", endPan);
    scroller.addEventListener("pointercancel", endPan);

    // capture phase, so this runs before the grid's own click handler
    scroller.addEventListener("click", function (e) {
      if (swallowNextClick) {
        swallowNextClick = false;
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  /* ---------- locating things ---------- */

  // Scrolls the viewport (not the whole page) so the cell is centred.
  function scrollCellIntoView(el) {
    if (typeof scroller.scrollTo !== "function") return;
    var s = scroller.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    scroller.scrollTo({
      left: scroller.scrollLeft + (r.left - s.left) - (s.width - r.width) / 2,
      top: scroller.scrollTop + (r.top - s.top) - (s.height - r.height) / 2,
      behavior: "smooth"
    });
    // on narrow screens the map can itself be off-screen
    if (typeof scroller.scrollIntoView === "function") {
      scroller.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // Marks sections as search matches. The mark stays (even through edits
  // that redraw the map) until clearFound() is called by the next search.
  var MATCH_NOTE = ", search match";
  function setFoundMark(el, on) {
    el.classList.toggle("cell--found", on);
    var label = (el.getAttribute("aria-label") || "").replace(MATCH_NOTE, "");
    el.setAttribute("aria-label", label + (on ? MATCH_NOTE : ""));
  }

  function clearFound() {
    foundIds = {};
    container.querySelectorAll(".cell--found").forEach(function (el) { setFoundMark(el, false); });
  }

  // Pulses every given section, marks it as a match, and scrolls the first
  // one into view. Used both by the per-result "Show on map" button (a
  // single id, added to the current marks) and by auto-locate after a
  // search (however many sections matched).
  function highlightSections(sectionIds) {
    var ids = (sectionIds || []).filter(function (id, i, arr) { return id && arr.indexOf(id) === i; });
    var first = true;
    ids.forEach(function (id) {
      var el = container.querySelector('[data-section-id="' + id + '"]');
      if (!el) return;
      if (first) {
        scrollCellIntoView(el);
        first = false;
      }
      foundIds[id] = true;
      setFoundMark(el, true);
      el.classList.add("cell--pulse");
      setTimeout(function () { el.classList.remove("cell--pulse"); }, 1600);
    });
  }

  function highlightSection(sectionId) {
    highlightSections([sectionId]);
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init: init,
    render: render,
    setMode: setMode,
    setRackSides: setRackSides,
    setZoom: setZoom,
    fitToView: fitToView,
    sizeViewport: sizeViewport,
    highlightSection: highlightSection,
    highlightSections: highlightSections,
    clearFound: clearFound
  };
})();
