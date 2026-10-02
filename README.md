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

### A note on where the data lives

There's no backend, so all racks, pallets, shelves and products are saved
in **your browser's local storage** — specific to one browser on one
device. That means:

- Data won't automatically appear on a different computer or a different
  browser, even on the same computer.
- Clearing browser data/cache can erase it.
- **Use "Export data" regularly.** It downloads a JSON file with everything
  in it. "Import data" loads that file back in (on the same device or a
  different one), replacing whatever's currently there.

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
css/styles.css     All styling
js/store.js        Data model + localStorage persistence + export/import
js/grid.js         Renders the grid, handles placing/erasing/selecting
js/editor.js       The rack/pallet modal: shelves and products
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
