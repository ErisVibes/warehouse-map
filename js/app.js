/* app.js
   Wires the other modules together and handles the toolbar, export/import
   and the warehouse-settings modal (grid size, search behavior, reset). */

(function () {
  "use strict";

  var HINTS = {
    select: "Click a rack or pallet to view and edit its shelves.",
    rack: "Click an empty square to place a rack.",
    pallet: "Click an empty square to place a pallet.",
    erase: "Click a rack or pallet to remove it."
  };

  document.addEventListener("DOMContentLoaded", function () {
    Store.load();

    var gridEl = document.getElementById("warehouseGrid");
    var sectionModal = document.getElementById("sectionModal");
    var searchPanel = document.getElementById("searchPanel");
    var settingsModal = document.getElementById("settingsModal");
    var toolbarHint = document.getElementById("toolbarHint");

    function refreshAll() {
      Grid.render();
      Search.refreshCategoryOptions();
    }

    Grid.init(gridEl, function (sectionId) { Editor.open(sectionId); });
    Editor.init(sectionModal, refreshAll);
    Search.init(searchPanel, {
      onLocate: function (sectionIds) { Grid.highlightSections(sectionIds); },
      onOpenSection: function (sectionId) { Editor.open(sectionId); }
    });

    document.querySelectorAll("[data-mode-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-mode-btn");
        Grid.setMode(mode);
        toolbarHint.textContent = HINTS[mode];
      });
    });

    /* ---- export ---- */
    document.getElementById("exportBtn").addEventListener("click", function () {
      var blob = new Blob([Store.exportJSON()], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = "warehouse-map-" + stamp + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    /* ---- import ---- */
    document.getElementById("importInput").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          if (!window.confirm("Importing will replace all data currently in this browser. Continue?")) return;
          Store.importJSON(reader.result);
          refreshAll();
        } catch (err) {
          window.alert("Couldn't import that file: " + err.message);
        }
        e.target.value = "";
      };
      reader.readAsText(file);
    });

    /* ---- settings modal ---- */
    var rowsInput = document.getElementById("rowsInput");
    var colsInput = document.getElementById("colsInput");
    var autoLocateToggle = document.getElementById("autoLocateToggle");

    function openSettings() {
      var meta = Store.getMeta();
      rowsInput.value = meta.rows;
      colsInput.value = meta.cols;
      autoLocateToggle.checked = meta.autoLocate !== false;
      settingsModal.hidden = false;
      document.body.classList.add("modal-open");
    }
    function closeSettings() {
      settingsModal.hidden = true;
      document.body.classList.remove("modal-open");
    }
    document.getElementById("settingsBtn").addEventListener("click", openSettings);
    settingsModal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close-settings")) closeSettings();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !settingsModal.hidden) closeSettings();
    });

    autoLocateToggle.addEventListener("change", function () {
      Store.setAutoLocate(autoLocateToggle.checked);
    });

    document.getElementById("resizeForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var rows = parseInt(rowsInput.value, 10) || Store.getMeta().rows;
      var cols = parseInt(colsInput.value, 10) || Store.getMeta().cols;
      var willRemove = Object.keys(Store.sections).some(function (id) {
        var s = Store.sections[id];
        return s.row >= rows || s.col >= cols;
      });
      if (willRemove && !window.confirm("This will delete racks/pallets (and their products) outside the new grid size. Continue?")) {
        return;
      }
      Store.resizeGrid(rows, cols);
      Grid.render();
      closeSettings();
    });

    document.getElementById("resetBtn").addEventListener("click", function () {
      if (window.confirm("Erase everything \u2014 the whole layout and every product? This can't be undone.")) {
        Store.resetAll();
        refreshAll();
        closeSettings();
      }
    });
  });
})();
