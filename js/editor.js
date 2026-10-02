/* editor.js
   The section modal: everything about one rack or pallet lives here -
   renaming it, adding/removing shelves (racks only), and adding, editing
   or removing the products stored on each shelf / on the pallet.

   Products can be added as a single item (one part number) or a range
   (a run of part numbers, e.g. "BP-1000 to BP-1099", stored as one entry
   instead of a hundred). Editing an existing entry keeps its original
   kind - you can't flip a single item into a range or back, since that
   would mean re-entering the data anyway. */

var Editor = (function () {
  "use strict";

  var modal, body, titleInput, typeLabel, deleteBtn;
  var currentSectionId = null;
  var openProductForm = null; // { shelfId, editingProductId, mode: 'single'|'range' } or null
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

  function open(sectionId) {
    currentSectionId = sectionId;
    openProductForm = null;
    render();
    modal.hidden = false;
    document.body.classList.add("modal-open");
    titleInput.focus();
  }

  function close() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    currentSectionId = null;
    openProductForm = null;
  }

  function render() {
    var section = Store.sections[currentSectionId];
    if (!section) { close(); return; }
    var scrollTop = body.scrollTop;
    titleInput.value = section.label;
    typeLabel.textContent = section.type === "rack" ? "RACK" : "PALLET";
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
    section.shelves.forEach(function (shelf) {
      wrap.appendChild(renderShelf(section, shelf));
    });
    var addShelfBtn = document.createElement("button");
    addShelfBtn.type = "button";
    addShelfBtn.className = "btn btn--outline";
    addShelfBtn.textContent = "+ Add shelf";
    addShelfBtn.addEventListener("click", function () {
      Store.addShelf(section.id);
      render();
      onChange();
    });
    wrap.appendChild(addShelfBtn);
    return wrap;
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
    tr.innerHTML =
      "<td class=\"mono\">" + partCell + "</td>" +
      "<td class=\"mono\">" + escapeHTML(product.lineCode) + "</td>" +
      "<td>" + escapeHTML(product.category) + "</td>" +
      "<td>" + escapeHTML(product.description) + "</td>" +
      "<td>" + product.qty + "</td>";
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
    var categories = Store.allCategories();
    var isRange = mode === "range";

    if (isRange) {
      form.appendChild(field("From part #", "text", "partNumberFrom", product ? product.partNumberFrom : "", true));
      form.appendChild(field("To part #", "text", "partNumberTo", product ? product.partNumberTo : "", true));
    } else {
      form.appendChild(field("Part number", "text", "partNumber", product ? product.partNumber : "", true));
    }
    form.appendChild(field("Line code", "text", "lineCode", product ? product.lineCode : "", false));
    form.appendChild(fieldWithList("Category", "category", product ? product.category : "", categories));
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
    saveBtn.textContent = product ? "Save changes" : "Add to " + (shelf ? shelf.label : section.label);
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
        category: fd.get("category") || "",
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

  function fieldWithList(labelText, name, value, options) {
    var wrap = document.createElement("label");
    wrap.className = "field";
    var span = document.createElement("span");
    span.className = "field__label";
    span.textContent = labelText;
    wrap.appendChild(span);
    var input = document.createElement("input");
    input.type = "text";
    input.name = name;
    input.value = value;
    input.setAttribute("list", "categoryOptions");
    wrap.appendChild(input);
    var list = document.getElementById("categoryOptions");
    if (list) {
      list.innerHTML = "";
      options.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt;
        list.appendChild(o);
      });
    }
    return wrap;
  }

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
  }

  return { init: init, open: open, close: close };
})();
