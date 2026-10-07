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
    var scrollEl = document.getElementById("mapScroll");
    var rackSidesToggle = document.getElementById("rackSidesToggle");
    var zoomRange = document.getElementById("zoomRange");
    var zoomValue = document.getElementById("zoomValue");

    var currentMode = "select";
    var rackTwoSided = false;

    function syncZoomUI() {
      var zoom = Store.getMeta().zoom;
      zoomRange.value = zoom;
      zoomValue.textContent = zoom + "%";
    }

    function refreshAll() {
      Grid.render();
      Search.refreshCategoryOptions();
      syncZoomUI();
    }

    function updateToolbar() {
      var hint = HINTS[currentMode];
      if (currentMode === "rack") {
        hint = "Click an empty square to place a " + (rackTwoSided ? "two-sided" : "one-sided") + " rack.";
      }
      toolbarHint.textContent = hint;
      rackSidesToggle.hidden = currentMode !== "rack";
    }

    Grid.init(gridEl, scrollEl, function (sectionId) { Editor.open(sectionId); });
    Editor.init(sectionModal, refreshAll);
    Search.init(searchPanel, {
      onLocate: function (sectionIds) { Grid.highlightSections(sectionIds); },
      onOpenSection: function (sectionId, shelfId) { Editor.open(sectionId, shelfId); }
    });

    document.querySelectorAll("[data-mode-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentMode = btn.getAttribute("data-mode-btn");
        Grid.setMode(currentMode);
        updateToolbar();
      });
    });

    /* ---- one-sided / two-sided rack choice (shown while placing racks) ---- */
    document.querySelectorAll("[data-rack-sides]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        rackTwoSided = btn.getAttribute("data-rack-sides") === "two";
        Grid.setRackSides(rackTwoSided);
        document.querySelectorAll("[data-rack-sides]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        updateToolbar();
      });
    });

    /* ---- zoom ---- */
    zoomRange.min = Store.ZOOM_MIN;
    zoomRange.max = Store.ZOOM_MAX;
    syncZoomUI();
    zoomRange.addEventListener("input", function () {
      Grid.setZoom(parseInt(zoomRange.value, 10));
      syncZoomUI();
    });
    document.getElementById("zoomOut").addEventListener("click", function () {
      Grid.setZoom(Store.getMeta().zoom - 10);
      syncZoomUI();
    });
    document.getElementById("zoomIn").addEventListener("click", function () {
      Grid.setZoom(Store.getMeta().zoom + 10);
      syncZoomUI();
    });
    document.getElementById("zoomFit").addEventListener("click", function () {
      Grid.fitToView();
      syncZoomUI();
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
    var darkModeToggle = document.getElementById("darkModeToggle");

    function openSettings() {
      var meta = Store.getMeta();
      rowsInput.value = meta.rows;
      colsInput.value = meta.cols;
      autoLocateToggle.checked = meta.autoLocate !== false;
      darkModeToggle.checked = Theme.isDark();
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

    darkModeToggle.addEventListener("change", function () {
      Theme.set(darkModeToggle.checked);
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
