// Manual dark/light override on top of the OS preference. tokens.css already
// implements [data-theme="dark"|"light"] alongside prefers-color-scheme —
// this module is just the state + the bit of JS wiring that was missing.
//
// The storage key is duplicated as a literal in /theme-init.js (a classic,
// non-module script that runs before first paint to avoid a flash of the
// wrong theme) — keep the two in sync if this ever changes.
const THEME_KEY = "schulblick.theme";

const THEME_COLOR = { light: "#F6F3EE", dark: "#14120F" };

export function getThemePreference() {
  try {
    return window.localStorage.getItem(THEME_KEY) ?? "system";
  } catch {
    return "system";
  }
}

export function setThemePreference(value) {
  try {
    window.localStorage.setItem(THEME_KEY, value);
  } catch {
    // Private browsing / storage disabled: the toggle still works for this
    // page load via applyTheme, it just won't persist across reloads.
  }
  applyTheme(value);
}

/**
 * @param {"system" | "light" | "dark"} value
 */
export function applyTheme(value) {
  if (value === "light" || value === "dark") {
    document.documentElement.dataset.theme = value;
  } else {
    delete document.documentElement.dataset.theme;
  }

  const resolved =
    value === "light" || value === "dark"
      ? value
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.getElementById("theme-color-meta")?.setAttribute("content", THEME_COLOR[resolved]);
}
