/* theme.js
   Light / dark mode. The choice is a per-device preference, so it lives in
   its own localStorage key rather than in the warehouse data (it isn't part
   of Export/Import). This file is loaded from <head>, before the page is
   painted, so a saved dark theme never flashes light first. The theme itself
   is just a data-theme="dark" attribute on <html>; the colours are in
   css/styles.css. */

var Theme = (function () {
  "use strict";

  var KEY = "warehouseMapTheme";

  function saved() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function isDark() {
    return document.documentElement.getAttribute("data-theme") === "dark";
  }

  function apply(dark) {
    if (dark) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
  }

  function set(dark) {
    apply(dark);
    try { window.localStorage.setItem(KEY, dark ? "dark" : "light"); } catch (e) { /* private mode: still works until reload */ }
  }

  apply(saved() === "dark");

  return { isDark: isDark, set: set };
})();
