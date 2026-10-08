/* search.js
   Three ways to find a product, all visible at once: by line code, by
   part number (matching a single item exactly/partially, or landing
   inside a stored range), and by category. Results link back to the map,
   and - unless turned off in settings - searching also pulses every
   matching location on the map automatically. */

var Search = (function () {
  "use strict";

  var panel, resultsEl, categorySelect;
  var onLocate = function () {}, onOpenSection = function () {}, onNewSearch = function () {};

  function init(panelEl, callbacks) {
    panel = panelEl;
    onLocate = callbacks.onLocate;
    onOpenSection = callbacks.onOpenSection;
    if (callbacks.onNewSearch) onNewSearch = callbacks.onNewSearch;
    resultsEl = panel.querySelector("#searchResults");
    categorySelect = panel.querySelector('select[name="category"]');

    panel.querySelector('form[data-panel="line"]').addEventListener("submit", function (e) {
      e.preventDefault();
      var lineCode = new FormData(e.target).get("lineCode").trim().toLowerCase();
      if (!lineCode) { showEmpty("Enter a line code to search."); return; }
      runResults(Store.allProducts().filter(function (p) {
        return p.lineCode.toLowerCase().indexOf(lineCode) !== -1;
      }));
    });

    panel.querySelector('form[data-panel="partNumber"]').addEventListener("submit", function (e) {
      e.preventDefault();
      var query = new FormData(e.target).get("query").trim();
      if (!query) { showEmpty("Enter a part number to search."); return; }
      var matches = Store.allProducts().filter(function (p) {
        return Store.productMatchesPartNumber(p, query);
      });
      matches.sort(function (a, b) {
        return Store.naturalCompare(Store.productDisplayPart(a), Store.productDisplayPart(b));
      });
      runResults(matches);
    });

    panel.querySelector('form[data-panel="category"]').addEventListener("submit", function (e) {
      e.preventDefault();
      var category = new FormData(e.target).get("category");
      if (!category) { showEmpty("Choose a category to search."); return; }
      runResults(Store.allProducts().filter(function (p) { return p.category === category; }));
    });

    refreshCategoryOptions();
  }

  function refreshCategoryOptions() {
    var current = categorySelect.value;
    categorySelect.innerHTML = '<option value="">Select a category\u2026</option>';
    var cats = Store.allCategories();
    cats.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
    if (cats.indexOf(current) !== -1) categorySelect.value = current;
  }

  function showEmpty(msg) {
    resultsEl.innerHTML = '<p class="search-results__empty">' + escapeHTML(msg) + "</p>";
  }

  function runResults(list) {
    onNewSearch(); // last search's map marks go away, even if this one finds nothing
    if (list.length === 0) { showEmpty("No products matched. Try widening the search."); return; }
    resultsEl.innerHTML = "";
    var count = document.createElement("p");
    count.className = "search-results__count";
    count.textContent = list.length + " result" + (list.length === 1 ? "" : "s");
    resultsEl.appendChild(count);

    list.forEach(function (product) {
      var section = Store.sections[product.sectionId];
      var row = document.createElement("article");
      row.className = "result";
      row.innerHTML =
        '<div class="result__main">' +
        '<p class="result__part mono">' +
        (product.lineCode ? '<span class="result__linecode">' + escapeHTML(product.lineCode) + "</span> \u00b7 " : "") +
        escapeHTML(Store.productDisplayPart(product)) +
        (product.isRange ? ' <span class="tag-range">range</span>' : "") + "</p>" +
        '<p class="result__desc">' + escapeHTML(product.description || "\u2014") + "</p>" +
        '<p class="result__meta">' +
        escapeHTML(product.category || "Uncategorized") + " \u00b7 qty " + product.qty +
        "</p>" +
        '<p class="result__location">' + escapeHTML(Store.locationLabel(product)) + "</p>" +
        "</div>";
      var actions = document.createElement("div");
      actions.className = "result__actions";
      if (section) {
        var locateBtn = document.createElement("button");
        locateBtn.type = "button";
        locateBtn.className = "btn btn--text";
        locateBtn.textContent = "Show on map";
        locateBtn.addEventListener("click", function () { onLocate([section.id]); });
        actions.appendChild(locateBtn);

        var openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "btn btn--text";
        openBtn.textContent = "Open";
        openBtn.addEventListener("click", function () { onOpenSection(section.id, product.shelfId); });
        actions.appendChild(openBtn);
      }
      row.appendChild(actions);
      resultsEl.appendChild(row);
    });

    if (Store.getMeta().autoLocate !== false) {
      var sectionIds = list.map(function (p) { return p.sectionId; });
      onLocate(sectionIds);
    }
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  return { init: init, refreshCategoryOptions: refreshCategoryOptions };
})();
