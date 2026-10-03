# Warehouse Map

A small, self-contained website for mapping a parts warehouse: lay out racks
and pallets (on a grid up to 50 × 50) with any number of shelves each,
track which products sit on each shelf — including whole runs of
sequential part numbers stored as one entry — and search by line code,
part number, or category.

It's plain HTML/CSS/JavaScript with no build step and no server — it runs
entirely in the browser and saves data to that browser's `localStorage`.

## Using it

- **Select** mode (default): click a rack or pallet to open it and edit its
  shelves and products.
- **Place rack** / **Place pallet**: click any empty square to add one there.
  It's given an automatic label (A1, B3, ...) that you can rename.
- **Erase**: click a rack or pallet to remove it (and whatever was stored on
  it).
- Inside a rack, use **+ Add shelf** / the **✕** on a shelf to change how
  many shelves it has, and **+ Add product** to put something on a shelf.
  You'll be asked to add it as a **single item** (one part number) or a
  **range of items** — see below.
- The **⚙ settings** button holds grid size, the auto-locate toggle, and
  **Erase all warehouse data**. **Export data** / **Import data** are in
  the header.
- The search panel on the right has three always-visible boxes: **Line
  code**, **Part number**, and **Category**. Every result has a **Show on
  map** button, and by default a search also pulses every matching
  location on the map automatically (turn that off in settings if you'd
  rather click "Show on map" yourself).

### Single items vs. ranges

If a shelf holds a run of sequential parts — say part #1000 through
part #1099 — you don't have to add all hundred individually. When adding
a product, choose **Range of items** and enter the first and last part
number; it's stored as one entry (shown as `1000–1099` with a small
"range" tag) and searching for anything in between, like `1050`, finds it.

Editing an existing entry keeps its original kind — a single item stays a
single item, a range stays a range.

### About part-number matching

The **Part number** search box does a plain substring match against single
items, and checks ranges properly: a part number is treated as alternating
letter/number chunks, so `BP1024`, `1024BP`, and `BP1024A`-style formats
(letters then numbers, numbers then letters, or letters-numbers-letters)
are all understood. A query only matches a range when its letters/
separators line up with the range's own start and end (so a search for
`AX-1050` won't match a `BP-1000` to `BP-1099` range) and its number falls
between the two. If you type a range's start and end in incompatible
formats, the form shows a warning since a search in between likely won't
find it.
