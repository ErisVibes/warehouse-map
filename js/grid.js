/* grid.js
   Draws the warehouse floor as a grid of cells and handles the placement
   toolbar modes: select, place-rack, place-pallet, erase. */

var Grid = (function () {
  "use strict";

  var mode = "select";
  var container = null;
  var onOpenSection = function () {};

  function init(el, openSectionCallback) {
    container = el;
    onOpenSection = openSectionCallback;
    container.addEventListener("click", handleClick);
    render();
  }

  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll("[data-mode-btn]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-mode-btn") === newMode);
    });
    container.classList.toggle("is-erasing", newMode === "erase");
    container.classList.toggle("is-placing", newMode === "rack" || newMode === "pallet");
  }

  function render() {
    var meta = Store.getMeta();
    container.style.setProperty("--cols", String(meta.cols));
    container.innerHTML = "";
    var frag = document.createDocumentFragment();
    for (var r = 0; r < meta.rows; r++) {
      for (var c = 0; c < meta.cols; c++) {
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
      btn.className = "cell cell--" + section.type;
      btn.setAttribute("data-section-id", section.id);
      var count = Store.sectionProductCount(section);
      btn.innerHTML =
        '<span class="cell__icon" aria-hidden="true">' + sectionIcon(section.type) + "</span>" +
        '<span class="cell__label">' + escapeHTML(section.label) + "</span>" +
        (count > 0 ? '<span class="cell__count">' + count + "</span>" : "");
      btn.setAttribute("aria-label", (section.type === "rack" ? "Rack " : "Pallet ") + section.label + ", " + count + (count === 1 ? " item" : " items"));
    } else {
      btn.innerHTML = '<span class="cell__plus" aria-hidden="true">+</span>';
      btn.setAttribute("aria-label", "Empty section, row " + (row + 1) + " column " + (col + 1));
    }
    return btn;
  }

  function sectionIcon(type) {
    if (type === "rack") {
      return '<svg viewBox="0 0 32 32" class="icon-rack"><rect x="4" y="4" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"/><line x1="4" y1="12" x2="28" y2="12" stroke="currentColor" stroke-width="2"/><line x1="4" y1="20" x2="28" y2="20" stroke="currentColor" stroke-width="2"/></svg>';
    }
    return '<svg viewBox="0 0 32 32" class="icon-pallet"><rect x="3" y="18" width="26" height="5" fill="none" stroke="currentColor" stroke-width="2"/><line x1="3" y1="23" x2="3" y2="27" stroke="currentColor" stroke-width="2"/><line x1="11" y1="23" x2="11" y2="27" stroke="currentColor" stroke-width="2"/><line x1="21" y1="23" x2="21" y2="27" stroke="currentColor" stroke-width="2"/><line x1="29" y1="23" x2="29" y2="27" stroke="currentColor" stroke-width="2"/><line x1="6" y1="9" x2="26" y2="9" stroke="currentColor" stroke-width="2"/><line x1="6" y1="14" x2="26" y2="14" stroke="currentColor" stroke-width="2"/></svg>';
  }

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
      Store.addSection(row, col, mode);
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

  // Pulses every given section and scrolls the first one into view. Used
  // both by the per-result "Show on map" button (a single id) and by
  // auto-locate after a search (however many sections matched).
  function highlightSections(sectionIds) {
    var ids = (sectionIds || []).filter(function (id, i, arr) { return id && arr.indexOf(id) === i; });
    var first = true;
    ids.forEach(function (id) {
      var el = container.querySelector('[data-section-id="' + id + '"]');
      if (!el) return;
      if (first && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        first = false;
      }
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
    highlightSection: highlightSection,
    highlightSections: highlightSections
  };
})();
