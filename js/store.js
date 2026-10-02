/* store.js
   Owns all warehouse data: the grid, racks, pallets, shelves and products.
   Persists to localStorage (this is a static site with no server, so the
   browser is the database). Export/Import JSON lets that data move between
   machines or become a real backup.

   Products come in two kinds:
   - a single item: one exact part number.
   - a range: "everything from part X to part Y is on this shelf" - used
     so you don't have to add product #1 through #100 individually when
     they physically sit together as a run. */

var Store = (function () {
  "use strict";

  var STORAGE_KEY = "warehouseMapData.v2";
  var GRID_MAX = 50;
  var data = null;

  function uid(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function colLabel(col) {
    // 0 -> A, 1 -> B ... 25 -> Z, 26 -> AA ...
    var s = "";
    col = col + 1;
    while (col > 0) {
      var rem = (col - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      col = Math.floor((col - 1) / 26);
    }
    return s;
  }

  function defaultSectionLabel(row, col) {
    return colLabel(col) + (row + 1);
  }

  function cellKey(row, col) {
    return row + "," + col;
  }

  function seedData() {
    return {
      meta: { rows: 6, cols: 8, autoLocate: true },
      cells: {},
      sections: {},
      products: {}
    };
  }

  function ensureMetaDefaults() {
    if (!data.meta) data.meta = {};
    if (data.meta.autoLocate === undefined) data.meta.autoLocate = true;
    if (!data.meta.rows) data.meta.rows = 6;
    if (!data.meta.cols) data.meta.cols = 8;
  }

  function load() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      console.warn("localStorage unavailable, using in-memory data only.", e);
    }
    if (raw) {
      try {
        data = JSON.parse(raw);
        ensureMetaDefaults();
        return;
      } catch (e) {
        console.warn("Saved warehouse data was corrupt, starting fresh.", e);
      }
    }
    data = seedData();
    seedSampleContent();
    save();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not save to localStorage.", e);
    }
  }

  function seedSampleContent() {
    var rackId = addSection(0, 0, "rack");
    var rack = data.sections[rackId];
    var s1 = rack.shelves[0].id;
    addProduct(rackId, s1, {
      partNumber: "BP-1024",
      lineCode: "MOOG",
      category: "Brakes",
      description: "Front brake pad set, ceramic",
      qty: 12
    });
    addProduct(rackId, s1, {
      isRange: true,
      partNumberFrom: "BP-1100",
      partNumberTo: "BP-1149",
      lineCode: "MOOG",
      category: "Brakes",
      description: "Rear brake pad sets, ceramic (sequential run)",
      qty: 50
    });
    var palletId = addSection(0, 2, "pallet");
    addProduct(palletId, null, {
      partNumber: "OF-2200",
      lineCode: "WIX",
      category: "Filters",
      description: "Oil filter, case of 24",
      qty: 3
    });
  }

  /* ---------- grid / sections ---------- */

  function getMeta() {
    return data.meta;
  }

  function setAutoLocate(enabled) {
    data.meta.autoLocate = !!enabled;
    save();
  }

  function resizeGrid(rows, cols) {
    rows = Math.max(1, Math.min(GRID_MAX, rows | 0));
    cols = Math.max(1, Math.min(GRID_MAX, cols | 0));
    var removed = [];
    Object.keys(data.cells).forEach(function (key) {
      var parts = key.split(",");
      var r = parseInt(parts[0], 10), c = parseInt(parts[1], 10);
      if (r >= rows || c >= cols) removed.push(key);
    });
    removed.forEach(function (key) {
      var sectionId = data.cells[key].id;
      deleteSection(sectionId, true);
    });
    data.meta.rows = rows;
    data.meta.cols = cols;
    save();
    return removed.length;
  }

  function getCell(row, col) {
    var entry = data.cells[cellKey(row, col)];
    if (!entry) return null;
    return data.sections[entry.id] || null;
  }

  function addSection(row, col, type) {
    if (getCell(row, col)) return null; // occupied
    var id = uid(type === "rack" ? "rack" : "pallet");
    var section = {
      id: id,
      type: type,
      row: row,
      col: col,
      label: defaultSectionLabel(row, col)
    };
    if (type === "rack") {
      section.shelves = [
        { id: uid("shelf"), label: "Shelf 1", productIds: [] },
        { id: uid("shelf"), label: "Shelf 2", productIds: [] },
        { id: uid("shelf"), label: "Shelf 3", productIds: [] }
      ];
    } else {
      section.productIds = [];
    }
    data.sections[id] = section;
    data.cells[cellKey(row, col)] = { id: id };
    save();
    return id;
  }

  function deleteSection(sectionId, skipSave) {
    var section = data.sections[sectionId];
    if (!section) return;
    var productIds = [];
    if (section.type === "rack") {
      section.shelves.forEach(function (sh) {
        productIds = productIds.concat(sh.productIds);
      });
    } else {
      productIds = section.productIds.slice();
    }
    productIds.forEach(function (pid) {
      delete data.products[pid];
    });
    delete data.cells[cellKey(section.row, section.col)];
    delete data.sections[sectionId];
    if (!skipSave) save();
  }

  function renameSection(sectionId, label) {
    var section = data.sections[sectionId];
    if (!section) return;
    section.label = label.trim() || section.label;
    save();
  }

  function sectionProductCount(section) {
    if (!section) return 0;
    if (section.type === "rack") {
      return section.shelves.reduce(function (n, sh) { return n + sh.productIds.length; }, 0);
    }
    return section.productIds.length;
  }

  /* ---------- shelves ---------- */

  function addShelf(rackId) {
    var rack = data.sections[rackId];
    if (!rack || rack.type !== "rack") return null;
    var n = rack.shelves.length + 1;
    var id = uid("shelf");
    rack.shelves.push({ id: id, label: "Shelf " + n, productIds: [] });
    save();
    return id;
  }

  function removeShelf(rackId, shelfId) {
    var rack = data.sections[rackId];
    if (!rack || rack.type !== "rack") return;
    var idx = rack.shelves.findIndex(function (s) { return s.id === shelfId; });
    if (idx === -1) return;
    rack.shelves[idx].productIds.forEach(function (pid) { delete data.products[pid]; });
    rack.shelves.splice(idx, 1);
    save();
  }

  function renameShelf(rackId, shelfId, label) {
    var rack = data.sections[rackId];
    if (!rack) return;
    var shelf = rack.shelves.find(function (s) { return s.id === shelfId; });
    if (!shelf) return;
    shelf.label = label.trim() || shelf.label;
    save();
  }

  /* ---------- products (single items and ranges) ---------- */

  function addProduct(sectionId, shelfId, fields) {
    var section = data.sections[sectionId];
    if (!section) return null;
    var id = uid("prod");
    var isRange = !!fields.isRange;
    var product = {
      id: id,
      isRange: isRange,
      partNumber: isRange ? "" : (fields.partNumber || "").trim(),
      partNumberFrom: isRange ? (fields.partNumberFrom || "").trim() : "",
      partNumberTo: isRange ? (fields.partNumberTo || "").trim() : "",
      lineCode: (fields.lineCode || "").trim(),
      category: (fields.category || "").trim(),
      description: (fields.description || "").trim(),
      qty: Math.max(0, parseInt(fields.qty, 10) || 0),
      sectionId: sectionId,
      shelfId: section.type === "rack" ? shelfId : null
    };
    data.products[id] = product;
    if (section.type === "rack") {
      var shelf = section.shelves.find(function (s) { return s.id === shelfId; });
      if (!shelf) { delete data.products[id]; return null; }
      shelf.productIds.push(id);
    } else {
      section.productIds.push(id);
    }
    save();
    return id;
  }

  function updateProduct(productId, fields) {
    var product = data.products[productId];
    if (!product) return;
    if (product.isRange) {
      if (fields.partNumberFrom !== undefined) product.partNumberFrom = String(fields.partNumberFrom).trim();
      if (fields.partNumberTo !== undefined) product.partNumberTo = String(fields.partNumberTo).trim();
    } else {
      if (fields.partNumber !== undefined) product.partNumber = String(fields.partNumber).trim();
    }
    ["lineCode", "category", "description"].forEach(function (key) {
      if (fields[key] !== undefined) product[key] = String(fields[key]).trim();
    });
    if (fields.qty !== undefined) product.qty = Math.max(0, parseInt(fields.qty, 10) || 0);
    save();
  }

  function removeProduct(productId) {
    var product = data.products[productId];
    if (!product) return;
    var section = data.sections[product.sectionId];
    if (section) {
      if (section.type === "rack") {
        var shelf = section.shelves.find(function (s) { return s.id === product.shelfId; });
        if (shelf) {
          var i = shelf.productIds.indexOf(productId);
          if (i !== -1) shelf.productIds.splice(i, 1);
        }
      } else {
        var j = section.productIds.indexOf(productId);
        if (j !== -1) section.productIds.splice(j, 1);
      }
    }
    delete data.products[productId];
    save();
  }

  function allProducts() {
    return Object.keys(data.products).map(function (id) { return data.products[id]; });
  }

  function allCategories() {
    var set = {};
    allProducts().forEach(function (p) { if (p.category) set[p.category] = true; });
    return Object.keys(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  function locationLabel(product) {
    var section = data.sections[product.sectionId];
    if (!section) return "Unplaced";
    if (section.type === "pallet") return "Pallet " + section.label;
    var shelf = section.shelves.find(function (s) { return s.id === product.shelfId; });
    return "Rack " + section.label + (shelf ? " \u2013 " + shelf.label : "");
  }

  function productDisplayPart(product) {
    if (product.isRange) return product.partNumberFrom + "\u2013" + product.partNumberTo;
    return product.partNumber;
  }

  /* ---------- part-number parsing & range matching ----------
     Splits a part number into alternating text/number tokens so formats
     like "BP1024", "1024BP" or "BP1024A" (letters-numbers, numbers-letters,
     letters-numbers-letters) are all handled the same way. A query matches
     a range only when it has the same token pattern (same letters/
     separators in the same places) and its numeric token(s) fall within
     the range's numeric token(s) - that's what makes "BP-1024" match a
     "BP-1000 to BP-1099" range but not a "AX-1000 to AX-1099" one. */

  function tokenize(str) {
    var re = /(\d+|\D+)/g;
    var matches = String(str || "").match(re) || [];
    return matches.map(function (tok) {
      return /^\d+$/.test(tok)
        ? { type: "num", value: parseInt(tok, 10) }
        : { type: "text", value: tok.toLowerCase() };
    });
  }

  function skeletonsCompatible(a, b) {
    var ta = tokenize(a), tb = tokenize(b);
    if (ta.length === 0 || ta.length !== tb.length) return false;
    for (var i = 0; i < ta.length; i++) {
      if (ta[i].type !== tb[i].type) return false;
      if (ta[i].type === "text" && ta[i].value !== tb[i].value) return false;
    }
    return true;
  }

  function partNumberInRange(query, from, to) {
    var q = tokenize(query), f = tokenize(from), t = tokenize(to);
    if (q.length === 0 || q.length !== f.length || q.length !== t.length) return false;
    for (var i = 0; i < q.length; i++) {
      if (q[i].type !== f[i].type || q[i].type !== t[i].type) return false;
      if (q[i].type === "text") {
        if (q[i].value !== f[i].value || q[i].value !== t[i].value) return false;
      } else {
        var lo = Math.min(f[i].value, t[i].value), hi = Math.max(f[i].value, t[i].value);
        if (q[i].value < lo || q[i].value > hi) return false;
      }
    }
    return true;
  }

  function productMatchesPartNumber(product, query) {
    query = (query || "").trim();
    if (!query) return false;
    if (product.isRange) {
      return partNumberInRange(query, product.partNumberFrom, product.partNumberTo);
    }
    return product.partNumber.toLowerCase().indexOf(query.toLowerCase()) !== -1;
  }

  /* ---------- natural comparison, used for sorting ---------- */
  // Splits into digit / non-digit runs so "PN-9" < "PN-10" when sorting
  // results (plain string comparison would put "PN-10" first).
  function naturalCompare(a, b) {
    a = String(a || ""); b = String(b || "");
    var re = /(\d+|\D+)/g;
    var aParts = a.match(re) || [];
    var bParts = b.match(re) || [];
    var len = Math.max(aParts.length, bParts.length);
    for (var i = 0; i < len; i++) {
      var ap = aParts[i] || "", bp = bParts[i] || "";
      if (ap === bp) continue;
      var aNum = /^\d+$/.test(ap), bNum = /^\d+$/.test(bp);
      if (aNum && bNum) {
        var diff = parseInt(ap, 10) - parseInt(bp, 10);
        if (diff !== 0) return diff < 0 ? -1 : 1;
      } else {
        return ap < bp ? -1 : 1;
      }
    }
    return 0;
  }

  /* ---------- export / import ---------- */

  function exportJSON() {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(json) {
    var parsed = JSON.parse(json);
    if (!parsed || !parsed.meta || !parsed.sections || !parsed.products || !parsed.cells) {
      throw new Error("That file doesn't look like a warehouse map export.");
    }
    data = parsed;
    ensureMetaDefaults();
    save();
  }

  function resetAll() {
    data = seedData();
    save();
  }

  return {
    load: load,
    save: save,
    GRID_MAX: GRID_MAX,
    getMeta: getMeta,
    setAutoLocate: setAutoLocate,
    resizeGrid: resizeGrid,
    getCell: getCell,
    cellKey: cellKey,
    addSection: addSection,
    deleteSection: deleteSection,
    renameSection: renameSection,
    sectionProductCount: sectionProductCount,
    addShelf: addShelf,
    removeShelf: removeShelf,
    renameShelf: renameShelf,
    addProduct: addProduct,
    updateProduct: updateProduct,
    removeProduct: removeProduct,
    allProducts: allProducts,
    allCategories: allCategories,
    locationLabel: locationLabel,
    productDisplayPart: productDisplayPart,
    productMatchesPartNumber: productMatchesPartNumber,
    skeletonsCompatible: skeletonsCompatible,
    naturalCompare: naturalCompare,
    exportJSON: exportJSON,
    importJSON: importJSON,
    resetAll: resetAll,
    get sections() { return data.sections; },
    get products() { return data.products; }
  };
})();
