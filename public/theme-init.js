// Applies the saved theme before first paint, so dark mode never flashes
// light, and decides whether the intro plays: only when signed in, since a
// login screen follows otherwise. Must stay a render-blocking classic script
// (modules defer) and can't be inline (CSP). Keep THEME_KEY and the colors in
// sync with js/state/theme.js, TOKEN_KEY with js/state/auth-store.js.
(() => {
  var THEME_KEY = "schulblick.theme";
  var THEME_COLOR = { light: "#F6F3EE", dark: "#14120F" };

  var stored;
  try {
    stored = window.localStorage.getItem(THEME_KEY);
  } catch {
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

  var TOKEN_KEY = "schulblick.token";
  var signedIn;
  try {
    signedIn = Boolean(window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY));
  } catch {
    signedIn = false;
  }
  if (signedIn) document.documentElement.dataset.splash = "on";
})();
