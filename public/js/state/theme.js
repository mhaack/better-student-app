// Manual dark/light override of the OS preference, via [data-theme] in
// tokens.css. THEME_KEY is duplicated in /theme-init.js; keep them in sync.
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
    // No storage: applies to this page load only.
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
