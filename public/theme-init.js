// Applies the saved theme override before first paint, so a dark-mode user
// never sees a flash of the light theme. Deliberately a classic script (not
// type="module", which always defers) loaded render-blocking from <head>,
// before the CSS <link> tags — modules can't run early enough for this.
//
// Duplicates two things from js/state/theme.js on purpose: this file can't
// import an ES module, and CSP (public/_headers: script-src 'self', no
// 'unsafe-inline') rules out putting this logic inline in index.html — it
// has to be its own same-origin file. Keep THEME_KEY and the color values in
// sync with state/theme.js if either changes.
(function () {
  var THEME_KEY = "schulblick.theme";
  var THEME_COLOR = { light: "#F6F3EE", dark: "#14120F" };

  var stored;
  try {
    stored = window.localStorage.getItem(THEME_KEY);
  } catch (e) {
    stored = null;
  }

  if (stored === "light" || stored === "dark") {
    document.documentElement.dataset.theme = stored;
  }

  var resolved =
    stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  var meta = document.getElementById("theme-color-meta");
  if (meta) meta.setAttribute("content", THEME_COLOR[resolved]);
})();
