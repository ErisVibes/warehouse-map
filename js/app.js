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
      onNewSearch: function () { Grid.clearFound(); },
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

    /* ---- export / import by copy and paste ----
       Some computers block file downloads, so backups are plain text: Export
       shows everything in a box to copy, Import takes it back from a box to
       paste into. Saving to / opening a file is still offered as a second option. */
    var dataModal = document.getElementById("dataModal");
    var dataTitle = document.getElementById("dataTitle");
    var dataHelp = document.getElementById("dataHelp");
    var dataText = document.getElementById("dataText");
    var dataStatus = document.getElementById("dataStatus");
    var dataExportActions = document.getElementById("dataExportActions");
    var dataImportActions = document.getElementById("dataImportActions");
    var dataKind = null; // "export" | "import"

    function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
    function describe(s) {
      return s.rows + " \u00d7 " + s.cols + " grid, " + plural(s.racks, "rack") + ", " + plural(s.pallets, "pallet") + ", " + plural(s.products, "product");
    }
    function setStatus(msg, kind) {
      dataStatus.textContent = msg || "";
      dataStatus.className = "data-status" + (kind ? " is-" + kind : "");
    }

    function openData(kind) {
      dataKind = kind;
      var isExport = kind === "export";
      dataTitle.textContent = isExport ? "Export data" : "Import data";
      dataExportActions.hidden = !isExport;
      dataImportActions.hidden = isExport;
      dataText.readOnly = isExport;
      dataText.placeholder = isExport ? "" : "Paste your backup text here\u2026";
      dataText.setAttribute("aria-label", isExport ? "Backup text to copy" : "Backup text to import");
      if (isExport) {
        dataHelp.textContent = "This text is your whole warehouse. Copy it and keep it somewhere safe \u2014 an email to yourself or a shared document works well. To restore it later, or to move it to another computer, use Import data and paste it back in.";
        dataText.value = Store.exportText();
        setStatus(describe(Store.currentSummary()) + " \u2014 " + Math.max(1, Math.round(dataText.value.length / 1024)) + " KB of text.");
      } else {
        dataHelp.textContent = "Paste a backup you copied from Export data. Importing replaces everything currently in this browser, so you'll be asked to confirm.";
        dataText.value = "";
        setStatus("");
      }
      dataModal.hidden = false;
      document.body.classList.add("modal-open");
      dataText.focus();
      if (isExport) dataText.select();
    }
    function closeData() {
      dataModal.hidden = true;
      document.body.classList.remove("modal-open");
      dataText.value = "";
      dataKind = null;
    }
    document.getElementById("exportBtn").addEventListener("click", function () { openData("export"); });
    document.getElementById("importBtn").addEventListener("click", function () { openData("import"); });
    dataModal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close-data")) closeData();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !dataModal.hidden) closeData();
    });

    document.getElementById("dataSelect").addEventListener("click", function () {
      dataText.focus();
      dataText.select();
      setStatus("Everything is selected \u2014 press Ctrl+C (\u2318C on a Mac) to copy it.");
    });

    document.getElementById("dataCopy").addEventListener("click", function () {
      var text = dataText.value;
      function copied() { setStatus("Copied. Paste it somewhere safe, such as an email to yourself.", "ok"); }
      function fallback() {
        var ok = false;
        dataText.focus();
        dataText.select();
        try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
        if (ok) copied();
        else setStatus("Couldn't copy automatically. The text is selected \u2014 press Ctrl+C (\u2318C on a Mac) to copy it.", "warn");
      }
      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(copied, fallback);
      } else {
        fallback();
      }
    });

    // optional: still offer an ordinary file download for computers that allow it
    document.getElementById("dataDownload").addEventListener("click", function () {
      var blob = new Blob([Store.exportJSON()], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "warehouse-map-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("If nothing was saved, your computer is blocking downloads \u2014 use Copy to clipboard instead.", "warn");
    });

    // as soon as text is pasted, say what it contains (or what's wrong with it)
    dataText.addEventListener("input", function () {
      if (dataKind !== "import") return;
      if (!dataText.value.trim()) { setStatus(""); return; }
      try {
        setStatus("Found a backup with " + describe(Store.inspectBackup(dataText.value)) + ". Press \u201cImport this data\u201d to load it.", "ok");
      } catch (err) {
        setStatus(err.message, "error");
      }
    });

    document.getElementById("importInput").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        dataText.value = String(reader.result);
        dataText.dispatchEvent(new Event("input"));
        e.target.value = "";
      };
      reader.readAsText(file);
    });

    document.getElementById("dataImport").addEventListener("click", function () {
      var incoming;
      try {
        incoming = Store.inspectBackup(dataText.value);
      } catch (err) {
        setStatus(err.message, "error");
        dataText.focus();
        return;
      }
      var msg = "Replace everything currently in this browser (" + describe(Store.currentSummary()) +
        ") with this backup (" + describe(incoming) + ")? This can't be undone.";
      if (!window.confirm(msg)) return;
      try {
        Store.importJSON(dataText.value);
      } catch (err) {
        setStatus(err.message, "error");
        return;
      }
      refreshAll();
      dataText.value = "";
      setStatus("Imported: " + describe(incoming) + ".", "ok");
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
