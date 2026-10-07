/* editor.js
   The section modal: everything about one rack or pallet lives here -
   renaming it, adding/removing shelves (racks only), and adding, editing
   or removing the products stored on each shelf / on the pallet.

   Products can be added as a single item (one part number) or a range
   (a run of part numbers, e.g. "BP-1000 to BP-1099", stored as one entry
   instead of a hundred). Editing an existing entry keeps its original
   kind - you can't flip a single item into a range or back, since that
   would mean re-entering the data anyway.

   The Category box in the product form is a combobox: a dropdown of every
   existing category that opens on focus and narrows as you type, but you can
   ignore it and type a brand-new category instead. */

var Editor = (function () {
  "use strict";

  var modal, body, titleInput, typeLabel, deleteBtn;
  var currentSectionId = null;
  var openProductForm = null; // { shelfId, editingProductId, mode: 'single'|'range' } or null
  var pendingOneSided = false; // true while asking what to do with the Right side's products
  var activeSide = "left";     // which side of a two-sided rack is showing
  var onChange = function () {};

  function init(modalEl, changeCallback) {
    modal = modalEl;
    onChange = changeCallback;
    body = modal.querySelector("#sectionModalBody");
    titleInput = modal.querySelector("#sectionModalLabel");
    typeLabel = modal.querySelector("#sectionModalType");
    deleteBtn = modal.querySelector("#sectionModalDelete");

    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !modal.hidden) close();
    });
    titleInput.addEventListener("change", function () {
      if (!currentSectionId) return;
      Store.renameSection(currentSectionId, titleInput.value);
      onChange();
    });
    deleteBtn.addEventListener("click", function () {
      var section = Store.sections[currentSectionId];
      if (!section) return;
      var count = Store.sectionProductCount(section);
      var msg = count > 0
        ? "Delete this " + section.type + " and its " + count + " stored product" + (count === 1 ? "" : "s") + "? This can't be undone."
        : "Delete this " + section.type + "?";
      if (window.confirm(msg)) {
        Store.deleteSection(currentSectionId);
        close();
        onChange();
      }
    });
  }

  // shelfId is optional: when the rack is opened from a search result, it
  // lets a two-sided rack open on the side that holds the product.
  function open(sectionId, shelfId) {
    currentSectionId = sectionId;
    openProductForm = null;
    pendingOneSided = false;
    activeSide = sideOfShelf(sectionId, shelfId);
    render();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    titleInput.focus();
  }

  function close() {
    closeCombo();
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    currentSectionId = null;
    openProductForm = null;
    pendingOneSided = false;
  }

  function render() {
    var section = Store.sections[currentSectionId];
    if (!section) { close(); return; }
    closeCombo();
    var scrollTop = body.scrollTop;
    titleInput.value = section.label;
    typeLabel.textContent = section.type === "rack" ? (section.twoSided ? "RACK · TWO-SIDED" : "RACK") : "PALLET";
    body.innerHTML = "";
    if (section.type === "rack") {
      body.appendChild(renderRack(section));
    } else {
      body.appendChild(renderPalletBody(section));
    }
    body.scrollTop = scrollTop;
  }

  function renderRack(section) {
    var wrap = document.createElement("div");
    wrap.className = "shelf-stack";
    wrap.appendChild(renderRackOptions(section));
    if (section.twoSided) {
      wrap.appendChild(renderSideToggle(section));
      wrap.appendChild(renderSide(section, activeSide));
    } else {
      section.shelves.forEach(function (shelf) {
        wrap.appendChild(renderShelf(section, shelf));
      });
      wrap.appendChild(addShelfButton(section, null));
    }
    return wrap;
  }

  function addShelfButton(section, side) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--outline";
    btn.textContent = "+ Add shelf";
    btn.addEventListener("click", function () {
      Store.addShelf(section.id, side);
      render();
      onChange();
    });
    return btn;
  }

  function sideOfShelf(sectionId, shelfId) {
    var section = Store.sections[sectionId];
    if (!section || !section.twoSided || !shelfId) return "left";
    var shelf = section.shelves.find(function (s) { return s.id === shelfId; });
    return shelf && shelf.side === "right" ? "right" : "left";
  }

  // The Left side / Right side switch at the top of a two-sided rack. Each
  // button shows how many products that side holds, so you can see where
  // things are without flipping back and forth.
  function renderSideToggle(section) {
    var toggle = document.createElement("div");
    toggle.className = "toggle-group side-toggle";
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", "Which side of the rack to show");
    ["left", "right"].forEach(function (side) {
      var n = Store.sideProductCount(section.id, side);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-btn" + (side === activeSide ? " is-active" : "");
      btn.setAttribute("aria-pressed", side === activeSide ? "true" : "false");
      btn.setAttribute("aria-label", Store.sideName(side) + " side" + (n > 0 ? ", " + n + " product" + (n === 1 ? "" : "s") : ""));
      btn.appendChild(document.createTextNode(Store.sideName(side) + " side"));
      if (n > 0) {
        var chip = document.createElement("span");
        chip.className = "toggle-btn__count";
        chip.textContent = String(n);
        btn.appendChild(chip);
      }
      btn.addEventListener("click", function () {
        if (side === activeSide) return;
        activeSide = side;
        openProductForm = null; // a half-filled form belongs to the other side
        render();
      });
      toggle.appendChild(btn);
    });
    return toggle;
  }

  // The shelves of one side of a two-sided rack, plus that side's own
  // "+ Add shelf" button.
  function renderSide(section, side) {
    var group = document.createElement("section");
    group.className = "side-group";
    group.setAttribute("aria-label", Store.sideName(side) + " side shelves");

    var shelves = section.shelves.filter(function (s) { return s.side === side; });
    if (shelves.length === 0) {
      var none = document.createElement("p");
      none.className = "product-list__empty";
      none.textContent = "No shelves on this side yet.";
      group.appendChild(none);
    }
    shelves.forEach(function (shelf) {
      group.appendChild(renderShelf(section, shelf));
    });
    group.appendChild(addShelfButton(section, side));
    return group;
  }

  // The "Has left and right sides" checkbox. Turning it on is immediate.
  // Turning it off asks what to do with the Right side's products first
  // (unless the Right side is empty, in which case there's nothing to ask).
  function renderRackOptions(section) {
    var box = document.createElement("div");
    box.className = "rack-options";

    var label = document.createElement("label");
    label.className = "field field--checkbox";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!section.twoSided;
    var text = document.createElement("span");
    text.textContent = "Has left and right sides";
    label.appendChild(cb);
    label.appendChild(text);
    box.appendChild(label);

    cb.addEventListener("change", function () {
      if (cb.checked) {
        Store.setRackTwoSided(section.id, true);
        activeSide = "left";
        pendingOneSided = false;
        render();
        onChange();
      } else if (Store.sideProductCount(section.id, "right") === 0) {
        Store.setRackTwoSided(section.id, false, "delete");
        pendingOneSided = false;
        render();
        onChange();
      } else {
        pendingOneSided = true;
        render();
      }
    });

    if (pendingOneSided && section.twoSided) box.appendChild(renderSideChoice(section));
    return box;
  }

  function renderSideChoice(section) {
    var n = Store.sideProductCount(section.id, "right");
    var plural = n === 1 ? "" : "s";
    var panel = document.createElement("div");
    panel.className = "side-choice";

    var msg = document.createElement("p");
    msg.className = "side-choice__msg";
    msg.textContent = "The Right side holds " + n + " product" + plural + ". What should happen to " + (n === 1 ? "it" : "them") + "?";
    panel.appendChild(msg);

    var note = document.createElement("p");
    note.className = "side-choice__note";
    note.textContent = "Merge keeps the Right side's shelves that hold products, adding them after this rack's existing shelves (empty ones are dropped).";
    panel.appendChild(note);

    var actions = document.createElement("div");
    actions.className = "side-choice__actions";

    var mergeBtn = document.createElement("button");
    mergeBtn.type = "button";
    mergeBtn.className = "btn btn--primary";
    mergeBtn.textContent = "Merge onto this rack";
    mergeBtn.addEventListener("click", function () { finishConvert(section, "merge"); });

    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn--outline btn--danger";
    deleteBtn.textContent = "Delete Right side and its " + n + " product" + plural;
    deleteBtn.addEventListener("click", function () { finishConvert(section, "delete"); });

    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--outline";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", function () {
      pendingOneSided = false;
      render();
    });

    actions.appendChild(mergeBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(cancelBtn);
    panel.appendChild(actions);
    return panel;
  }

  function finishConvert(section, action) {
    Store.setRackTwoSided(section.id, false, action);
    pendingOneSided = false;
    render();
    onChange();
  }

  function renderShelf(section, shelf) {
    var box = document.createElement("div");
    box.className = "shelf";

    var head = document.createElement("div");
    head.className = "shelf__head";

    var bar = document.createElement("div");
    bar.className = "shelf__bar";
    bar.setAttribute("aria-hidden", "true");
    head.appendChild(bar);

    var labelInput = document.createElement("input");
    labelInput.className = "shelf__label-input";
    labelInput.value = shelf.label;
    labelInput.setAttribute("aria-label", "Shelf name");
    labelInput.addEventListener("change", function () {
      Store.renameShelf(section.id, shelf.id, labelInput.value);
      onChange();
    });
    head.appendChild(labelInput);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn--icon btn--danger";
    removeBtn.setAttribute("aria-label", "Remove " + shelf.label);
    removeBtn.textContent = "\u2715";
    removeBtn.addEventListener("click", function () {
      var n = shelf.productIds.length;
      var msg = n > 0 ? "Remove this shelf and its " + n + " product" + (n === 1 ? "" : "s") + "?" : "Remove this shelf?";
      if (window.confirm(msg)) {
        Store.removeShelf(section.id, shelf.id);
        render();
        onChange();
      }
    });
    head.appendChild(removeBtn);
    box.appendChild(head);

    box.appendChild(renderProductList(section, shelf));
    return box;
  }

  function renderPalletBody(section) {
    var wrap = document.createElement("div");
    wrap.className = "shelf-stack";
    wrap.appendChild(renderProductList(section, null));
    return wrap;
  }

  function renderProductList(section, shelf) {
    var listWrap = document.createElement("div");
    listWrap.className = "product-list";

    var ids = shelf ? shelf.productIds : section.productIds;
    if (ids.length === 0) {
      var empty = document.createElement("p");
      empty.className = "product-list__empty";
      empty.textContent = "Nothing stored here yet.";
      listWrap.appendChild(empty);
    } else {
      var table = document.createElement("table");
      table.className = "product-table";
      table.innerHTML =
        "<thead><tr><th>Part #</th><th>Line</th><th>Category</th><th>Description</th><th>Qty</th><th></th></tr></thead>";
      var tbody = document.createElement("tbody");
      ids.forEach(function (pid) {
        var product = Store.products[pid];
        if (!product) return;
        if (openProductForm && openProductForm.editingProductId === pid) {
          tbody.appendChild(buildProductFormRow(section, shelf, product));
        } else {
          tbody.appendChild(buildProductRow(section, shelf, product));
        }
      });
      table.appendChild(tbody);
      listWrap.appendChild(table);
    }

    var shelfId = shelf ? shelf.id : null;
    if (openProductForm && openProductForm.shelfId === shelfId && !openProductForm.editingProductId) {
      listWrap.appendChild(buildAddBlock(section, shelf));
    } else {
      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn--text";
      addBtn.textContent = "+ Add product";
      addBtn.addEventListener("click", function () {
        openProductForm = { shelfId: shelfId, editingProductId: null, mode: "single" };
        render();
      });
      listWrap.appendChild(addBtn);
    }
    return listWrap;
  }

  function buildProductRow(section, shelf, product) {
    var tr = document.createElement("tr");
    var partCell = product.isRange
      ? escapeHTML(Store.productDisplayPart(product)) + ' <span class="tag-range">range</span>'
      : escapeHTML(Store.productDisplayPart(product));
    // data-label feeds the stacked card layout used on narrow screens
    tr.innerHTML =
      "<td class=\"mono\">" + partCell + "</td>" +
      "<td class=\"mono\" data-label=\"Line\">" + escapeHTML(product.lineCode) + "</td>" +
      "<td data-label=\"Category\">" + escapeHTML(product.category) + "</td>" +
      "<td>" + escapeHTML(product.description) + "</td>" +
      "<td data-label=\"Qty\">" + product.qty + "</td>";
    var actionsTd = document.createElement("td");
    actionsTd.className = "product-table__actions";
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn--text";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openProductForm = { shelfId: shelf ? shelf.id : null, editingProductId: product.id, mode: product.isRange ? "range" : "single" };
      render();
    });
    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn--text btn--danger";
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", function () {
      if (window.confirm("Remove " + (Store.productDisplayPart(product) || "this product") + "?")) {
        Store.removeProduct(product.id);
        render();
        onChange();
      }
    });
    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);
    return tr;
  }

  function buildProductFormRow(section, shelf, product) {
    var tr = document.createElement("tr");
    tr.className = "product-table__form-row";
    var td = document.createElement("td");
    td.colSpan = 6;
    td.appendChild(buildFormFields(section, shelf, product, product.isRange ? "range" : "single"));
    tr.appendChild(td);
    return tr;
  }

  // The "+ Add product" block: a Single item / Range of items toggle plus
  // the matching form. Only shown when adding new - editing an existing
  // entry goes straight to buildFormFields with its fixed kind.
  function buildAddBlock(section, shelf) {
    var wrap = document.createElement("div");

    var toggle = document.createElement("div");
    toggle.className = "toggle-group";
    toggle.setAttribute("role", "group");
    toggle.setAttribute("aria-label", "Add a single item or a range");
    ["single", "range"].forEach(function (m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-btn" + (openProductForm.mode === m ? " is-active" : "");
      btn.textContent = m === "single" ? "Single item" : "Range of items";
      btn.addEventListener("click", function () {
        openProductForm.mode = m;
        render();
      });
      toggle.appendChild(btn);
    });
    wrap.appendChild(toggle);
    wrap.appendChild(buildFormFields(section, shelf, null, openProductForm.mode));
    return wrap;
  }

  function buildFormFields(section, shelf, product, mode) {
    var form = document.createElement("form");
    form.className = "product-form";
    var isRange = mode === "range";

    if (isRange) {
      form.appendChild(field("From part #", "text", "partNumberFrom", product ? product.partNumberFrom : "", true));
      form.appendChild(field("To part #", "text", "partNumberTo", product ? product.partNumberTo : "", true));
    } else {
      form.appendChild(field("Part number", "text", "partNumber", product ? product.partNumber : "", true));
    }
    form.appendChild(field("Line code", "text", "lineCode", product ? product.lineCode : "", false));
    form.appendChild(categoryCombobox("Category", "category", product ? product.category : ""));
    form.appendChild(field("Description", "text", "description", product ? product.description : "", false));
    form.appendChild(field("Qty", "number", "qty", product ? product.qty : 1, false));

    if (isRange) {
      var warning = document.createElement("p");
      warning.className = "form-warning";
      warning.hidden = true;
      warning.textContent = "These two part numbers don't share the same pattern, so a search in between might not find this range.";
      form.appendChild(warning);
      var fromInput = form.querySelector('[name="partNumberFrom"]');
      var toInput = form.querySelector('[name="partNumberTo"]');
      var checkSkeleton = function () {
        var f = fromInput.value.trim(), t = toInput.value.trim();
        warning.hidden = !(f && t && !Store.skeletonsCompatible(f, t));
      };
      fromInput.addEventListener("blur", checkSkeleton);
      toInput.addEventListener("blur", checkSkeleton);
    }

    var actions = document.createElement("div");
    actions.className = "product-form__actions";
    var saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn btn--primary";
    saveBtn.textContent = product ? "Save changes" : "Add to " + (shelf
      ? (shelf.side ? Store.sideName(shelf.side) + " – " : "") + shelf.label
      : section.label);
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btn--outline";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", function () {
      openProductForm = null;
      render();
    });
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    form.appendChild(actions);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      var fields = {
        isRange: isRange,
        lineCode: fd.get("lineCode") || "",
        category: canonicalCategory(fd.get("category"), product),
        description: fd.get("description") || "",
        qty: fd.get("qty") || 0
      };
      if (isRange) {
        fields.partNumberFrom = fd.get("partNumberFrom") || "";
        fields.partNumberTo = fd.get("partNumberTo") || "";
        if (!fields.partNumberFrom.trim()) { form.querySelector('[name="partNumberFrom"]').focus(); return; }
        if (!fields.partNumberTo.trim()) { form.querySelector('[name="partNumberTo"]').focus(); return; }
      } else {
        fields.partNumber = fd.get("partNumber") || "";
        if (!fields.partNumber.trim()) { form.querySelector('[name="partNumber"]').focus(); return; }
      }
      if (product) {
        Store.updateProduct(product.id, fields);
      } else {
        Store.addProduct(section.id, shelf ? shelf.id : null, fields);
      }
      openProductForm = null;
      render();
      onChange();
    });

    return form;
  }

  function field(labelText, type, name, value, required) {
    var wrap = document.createElement("label");
    wrap.className = "field";
    var span = document.createElement("span");
    span.className = "field__label";
    span.textContent = labelText;
    wrap.appendChild(span);
    var input = document.createElement("input");
    input.type = type;
    input.name = name;
    input.value = value;
    if (type === "number") { input.min = "0"; input.step = "1"; }
    if (required) input.required = true;
    if (name === "partNumber" || name === "partNumberFrom" || name === "partNumberTo" || name === "lineCode") {
      input.className = "mono";
    }
    wrap.appendChild(input);
    return wrap;
  }

  // If what was typed matches an existing category apart from capitals or
  // stray spaces ("brakes" vs "Brakes"), use the existing spelling so the
  // category search doesn't end up with near-duplicates. The product being
  // edited doesn't count, so its own category's capitals can still be changed.
  function canonicalCategory(raw, editing) {
    var typed = String(raw == null ? "" : raw).trim();
    var lower = typed.toLowerCase();
    var existing = {};
    Store.allProducts().forEach(function (p) {
      if (p.category && (!editing || p.id !== editing.id)) existing[p.category] = true;
    });
    var names = Object.keys(existing).sort();
    for (var i = 0; i < names.length; i++) {
      if (names[i].toLowerCase() === lower) return names[i];
    }
    return typed;
  }

  /* ---- category combobox ----
     A text box plus a dropdown of every existing category. The list opens
     when the box is focused or clicked (showing all categories), narrows to
     matches as you type, and never gets in the way: whatever is in the box
     when the form is saved is the category, so a new one is just typed in.
     Keyboard: Down/Up move through the list, Enter picks the highlighted
     one (otherwise Enter saves the form as usual), Esc closes the list,
     Tab moves on. The list is position:fixed so the scrolling modal body
     can't clip it, and it flips above the box when there's no room below. */
  var comboSeq = 0;
  var activeCombo = null; // the open combobox's { close() }, if any

  function closeCombo() { if (activeCombo) activeCombo.close(); }

  function categoryCombobox(labelText, name, value) {
    var uid = "catcombo" + (++comboSeq);
    var wrap = document.createElement("div");
    wrap.className = "field combo";

    var label = document.createElement("label");
    label.className = "field__label";
    label.htmlFor = uid + "-input";
    label.textContent = labelText;
    wrap.appendChild(label);

    var box = document.createElement("div");
    box.className = "combo__box";

    var input = document.createElement("input");
    input.type = "text";
    input.name = name;
    input.id = uid + "-input";
    input.value = value;
    input.autocomplete = "off";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", uid + "-list");
    box.appendChild(input);

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "combo__toggle";
    toggle.tabIndex = -1;
    toggle.setAttribute("aria-label", "Show all categories");
    toggle.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 4.2l4 3.8 4-3.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    box.appendChild(toggle);

    var list = document.createElement("ul");
    list.className = "combo__list";
    list.id = uid + "-list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", labelText + " suggestions");
    list.hidden = true;
    box.appendChild(list);
    wrap.appendChild(box);

    var items = [];        // the categories currently listed (hint row excluded)
    var activeIndex = -1;  // keyboard highlight; -1 = none, so Enter still saves the form
    var isOpen = false;
    var api = { close: hide };

    function build(filterText) {
      var q = filterText.trim().toLowerCase();
      var all = Store.allCategories();
      if (!q) {
        items = all;
      } else {
        var starts = [], contains = [];
        all.forEach(function (c) {
          var at = c.toLowerCase().indexOf(q);
          if (at === 0) starts.push(c); else if (at > 0) contains.push(c);
        });
        items = starts.concat(contains);
      }
      activeIndex = -1;
      list.innerHTML = "";
      input.removeAttribute("aria-activedescendant");

      var current = input.value.trim().toLowerCase();
      items.forEach(function (cat, i) {
        var li = document.createElement("li");
        li.className = "combo__option" + (cat.toLowerCase() === current ? " is-current" : "");
        li.id = uid + "-opt-" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", cat.toLowerCase() === current ? "true" : "false");
        // the name sits in one span so the highlighted letters stay inline with
        // the rest of it (the row itself is flex, for the "current" tick)
        var txt = document.createElement("span");
        txt.className = "combo__text";
        var at = q ? cat.toLowerCase().indexOf(q) : -1;
        if (at >= 0) {
          txt.appendChild(document.createTextNode(cat.slice(0, at)));
          var m = document.createElement("mark");
          m.className = "combo__match";
          m.textContent = cat.slice(at, at + q.length);
          txt.appendChild(m);
          txt.appendChild(document.createTextNode(cat.slice(at + q.length)));
        } else {
          txt.textContent = cat;
        }
        li.appendChild(txt);
        li.addEventListener("click", function () { choose(cat); });
        list.appendChild(li);
      });

      if (items.length === 0 && q) {
        var hint = document.createElement("li");
        hint.className = "combo__hint";
        hint.setAttribute("role", "option");
        hint.setAttribute("aria-disabled", "true");
        hint.textContent = "No existing category matches — “" + filterText.trim() + "” will be saved as a new one.";
        list.appendChild(hint);
      }
      return list.children.length > 0;
    }

    function position() {
      var r = input.getBoundingClientRect();
      var bodyRect = body.getBoundingClientRect();
      if (r.bottom < bodyRect.top || r.top > bodyRect.bottom) { hide(); return; } // scrolled out of view
      var below = window.innerHeight - r.bottom - 8, above = r.top - 8;
      list.style.left = r.left + "px";
      list.style.width = r.width + "px";
      list.style.maxHeight = "none";
      var natural = Math.min(list.scrollHeight + 10, 240);
      var placeBelow = below >= Math.min(natural, 160) || below >= above;
      var room = Math.max(80, placeBelow ? below : above);
      var h = Math.min(natural, room);
      list.style.maxHeight = Math.min(240, room) + "px";
      list.style.top = (placeBelow ? r.bottom + 2 : r.top - h - 2) + "px";
    }

    function onViewportChange(e) {
      if (e && e.target === list) return; // the list scrolling itself
      position();
    }

    function show(filterText) {
      if (!build(filterText)) { hide(); return; }
      closeCombo();                 // only one list open at a time
      list.hidden = false;
      isOpen = true;
      input.setAttribute("aria-expanded", "true");
      activeCombo = api;
      window.addEventListener("resize", onViewportChange);
      window.addEventListener("scroll", onViewportChange, true);
      position();
      var cur = list.querySelector(".is-current");
      if (cur) list.scrollTop = Math.max(0, cur.offsetTop - 40);
    }

    function hide() {
      if (isOpen) {
        window.removeEventListener("resize", onViewportChange);
        window.removeEventListener("scroll", onViewportChange, true);
      }
      isOpen = false;
      list.hidden = true;
      activeIndex = -1;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      if (activeCombo === api) activeCombo = null;
    }

    function choose(cat) {
      input.value = cat;
      hide();
      input.focus();
    }

    function setActive(i) {
      var opts = list.querySelectorAll(".combo__option");
      if (activeIndex >= 0 && opts[activeIndex]) opts[activeIndex].classList.remove("is-active");
      activeIndex = i;
      if (i >= 0 && opts[i]) {
        var el = opts[i];
        el.classList.add("is-active");
        input.setAttribute("aria-activedescendant", el.id);
        if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 4;
        else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 4;
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    input.addEventListener("focus", function () { show(""); });
    input.addEventListener("click", function () { if (!isOpen) show(""); });
    input.addEventListener("input", function () { show(input.value); });
    input.addEventListener("blur", hide);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!isOpen) { show(""); return; }
        if (items.length === 0) return;
        var step = e.key === "ArrowDown" ? 1 : -1;
        var next = activeIndex < 0 ? (step === 1 ? 0 : items.length - 1) : (activeIndex + step + items.length) % items.length;
        setActive(next);
      } else if (e.key === "Enter") {
        if (isOpen && activeIndex >= 0) { e.preventDefault(); choose(items[activeIndex]); }
      } else if (e.key === "Escape") {
        if (isOpen) { e.preventDefault(); e.stopPropagation(); hide(); } // close the list, not the whole window
      } else if (e.key === "Tab") {
        hide();
      }
    });

    // keep focus in the text box while the list or arrow is pressed
    list.addEventListener("mousedown", function (e) { e.preventDefault(); });
    toggle.addEventListener("mousedown", function (e) { e.preventDefault(); });
    toggle.addEventListener("click", function () {
      if (isOpen) { hide(); input.focus(); return; }
      var focused = document.activeElement === input;
      input.focus();                 // focusing opens the list by itself...
      if (focused) show("");         // ...unless it already had focus
    });

    return wrap;
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  return { init: init, open: open, close: close };
})();
