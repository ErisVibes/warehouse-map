# Warehouse Map

A small, self-contained website for mapping a parts warehouse: lay out racks
and pallets (on a grid up to 50 × 50) with any number of shelves each,
track which products sit on each shelf — including whole runs of
sequential part numbers stored as one entry — and search by line code,
part number, or category.

It's plain HTML/CSS/JavaScript with no build step and no server — it runs
entirely in the browser and saves data to that browser's `localStorage`.
That's what makes it free to host on GitHub Pages (or any static host).

## Using it

- **Select** mode (default): click a rack or pallet to open it and edit its
  shelves and products.
- **Place rack** / **Place pallet**: click any empty square to add one there.
  It's given an automatic label (A1, B3, ...) that you can rename. While
  **Place rack** is active, a **One-sided rack / Two-sided rack** choice
  appears next to the buttons — see "One-sided and two-sided racks" below.
- **Erase**: click a rack or pallet to remove it (and whatever was stored on
  it).
- Inside a rack, use **+ Add shelf** / the **✕** on a shelf to change how
  many shelves it has, and **+ Add product** to put something on a shelf.
  You'll be asked to add it as a **single item** (one part number) or a
  **range of items** — see below.
- The **Category** box in the product form is a drop-down of every category
  already in your warehouse. Click into it and the whole list appears; start
  typing and it narrows to the matches (the letters you typed are
  underlined), then click one — or use ↑ / ↓ and **Enter** — to pick it.
  You can also just ignore the list and type a brand-new category; whatever
  is in the box when you save is what's stored. If you type an existing
  category with different capitals (`brakes` for `Brakes`), it reuses the
  existing spelling so you don't end up with near-duplicates. **Esc** closes
  the list without closing the rack window.
- The **⚙ settings** button holds **Dark mode**, grid size, the auto-locate
  toggle, and **Erase all warehouse data**. **Export data** /
  **Import data** (copy/paste backups) are in the header.
- The search panel on the right has three always-visible boxes: **Line
  code**, **Part number**, and **Category**. Every result has a **Show on
  map** button, and by default a search also pulses every matching
  location on the map automatically (turn that off in settings if you'd
  rather click "Show on map" yourself). Matching racks and pallets then
  keep an amber ring around them until your **next search** (even one
  that finds nothing clears it), so you can come back to the map and still
  see where to go. "Show on map" adds its rack to the ringed ones.
- On the map, a rack with **no products** at all is grey instead of blue
  (it turns blue as soon as something is stored on it), and each square's
  badge shows how many products it holds.

### Getting around a big warehouse

The map has its own scrolling window, sized to fit your screen, so both
scroll bars are always visible no matter how large the grid is.

- **Drag** anywhere on the map to pan it (mouse). A press only becomes a
  drag after you move a few pixels, so ordinary clicks still select, place
  or erase as usual — and finishing a drag never triggers one. On a touch
  screen, just swipe.
- **Zoom** with the − / + buttons or the slider above the map (10%–200%).
  The level is remembered between visits. At small sizes the icons, then the
  labels, are hidden to make room; the colours still show what's what.
- **Fit** picks the largest zoom at which the whole grid is on screen at
  once. On a small laptop screen a full 50 × 50 grid fits at about 10%,
  where each square is only a few pixels — handy as an overview, then zoom
  back in to work.
- Column letters and row numbers stay pinned to the top and left edges while
  you scroll, so you can always tell where you are.
- **Show on map** (and automatic locate after a search) scrolls the map
  window to the matching square, wherever it is.

### One-sided and two-sided racks

Some racks have a left and a right side, others don't.

- **Placing:** choose **Place rack**, then pick **One-sided rack** or
  **Two-sided rack**. A two-sided rack starts with 3 shelves on each side. On
  the map it's drawn with a divider down the middle (and has its own legend
  entry), so you can tell them apart at a glance. When you zoom out far
  enough that the icons disappear, the square itself is still split in two
  by a thin line.
- **Editing:** open a two-sided rack and you'll see a **Left side / Right side**
  switch at the top. Only one side is shown at a time, so the shelves never
  stack up into one long list; each side has its own shelves and its own
  **+ Add shelf**. A small number on each switch button tells you how many
  products that side holds, so you can see at a glance where things are.
  Opening a rack from the map starts on the Left side; clicking **Open** on a
  search result jumps straight to the side (and shelf) that holds the product.
  On the map, a two-sided rack has one count badge per side, in the matching
  top corner (left badge = Left side's products, right badge = Right side's;
  a side with nothing on it has no badge). Search results show where something
  is, e.g. *Rack A1 – Right – Shelf 2*.
- **Changing your mind:** tick or untick **Has left and right sides** in the
  rack's window.
  - Making a rack two-sided keeps all its current shelves as the Left side and
    adds an empty Right side with the same number of shelves.
  - Making it one-sided asks what to do with the Right side if it holds
    products: **Merge onto this rack** keeps the Right side's shelves that
    hold products (added after the existing shelves; empty ones are dropped),
    or **Delete Right side** removes them along with their products. If the
    Right side is empty, it just converts.

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

### A note on where the data lives

There's no backend, so all racks, pallets, shelves and products are saved
in **your browser's local storage** — specific to one browser on one
device. That means:

- Data won't automatically appear on a different computer or a different
  browser, even on the same computer.
- Clearing browser data/cache can erase it.
- The **Dark mode** choice is remembered per browser too, but it's a display
  preference rather than warehouse data, so it isn't included in Export /
  Import and isn't touched by "Erase all warehouse data".
- **Use "Export data" regularly.** It shows your whole warehouse as a block of
  plain text with a **Copy to clipboard** button — no file download needed,
  so it works on computers that block downloads. Paste that text somewhere
  safe (an email to yourself, a shared document, a chat). **Import data** is
  the reverse: paste the text into the box and press **Import this data**
  (on the same device or a different one). It first tells you what it found
  and asks before replacing whatever's there now.
  - Text that has been through email is fine: extra blank lines, a greeting
    or signature around it, lines wrapped by the mail program, and curly
    quotes are all tolerated. A backup with part of the end cut off is
    refused with a message, and nothing is changed.
  - If Copy doesn't work (some locked-down browsers block it), the text is
    left selected so you can press Ctrl+C. **Save as a file instead** /
    **Open a file instead** are still there for computers that do allow files.
  - Backups are compact text, roughly 400 characters per product, so a
    warehouse with a few thousand products is a few hundred KB.

If several people at the store need to see the same live map at once, that
requires a shared backend, which is a bigger project than a static GitHub
Pages site — see "If you outgrow this" below.

## Hosting it on GitHub Pages (free)

1. Create a new repository on GitHub (public repos get free Pages hosting;
   private repos need a paid plan).
2. Add these files to the repository, keeping the folder structure exactly
   as-is (`index.html` at the root, with `css/` and `js/` beside it).
   - Easiest way: on the repo's GitHub page, click **Add file → Upload
     files**, then drag in `index.html`, the `css` folder, and the `js`
     folder together, and commit.
3. Go to the repo's **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a
   branch**, branch **main**, folder **/ (root)**. Save.
5. GitHub gives you a URL like `https://yourusername.github.io/your-repo/`
   after a minute or two — that's the live site.

Any time you edit the files and push/commit again, the live site updates
automatically within a minute or so.

### Trying it locally first

You can just double-click `index.html` to open it in a browser, but some
browsers restrict `localStorage` for files opened directly from disk
(`file://`). If your data doesn't seem to save between visits, run a tiny
local server from this folder instead:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. This isn't needed once it's on GitHub
Pages — real https:// hosting doesn't have this restriction.

## File structure

```
index.html        Page structure: header, toolbar, grid, search panel, modals
css/styles.css     All styling (including the dark theme's colours)
js/theme.js        Light / dark mode (loaded in <head> so there's no flash)
js/store.js        Data model + localStorage persistence + export/import
js/grid.js         Renders the grid, placing/erasing/selecting, zoom, Fit, drag-to-pan
js/editor.js       The rack/pallet modal: sides, shelves and products
js/search.js       The three search modes and results list
js/app.js          Wires it all together, toolbar + settings
```

## If you outgrow this

If it eventually needs to be a shared, always-in-sync tool for multiple
people at once (rather than one browser's local data), the natural next
step is pairing this same front end with a small free-tier backend —
something like Supabase or Firebase — so everyone reads and writes the same
data. That's a genuinely different project (accounts, a real database,
sync), so it's left out of this version on purpose to keep it simple and
free to host as-is. Happy to help design that step if/when it's needed.
