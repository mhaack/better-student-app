// Applies the saved theme before first paint, so dark mode never flashes
// light. Must stay a render-blocking classic script (modules defer) and
// can't be inline (CSP). Keep THEME_KEY and the colors in sync with
// js/state/theme.js.
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
