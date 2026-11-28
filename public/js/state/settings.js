// Non-theme preferences. Not sensitive, so plain localStorage.
import { DEFAULT_CUTOFF_HOUR, CUTOFF_HOUR_OPTIONS } from "../domain/school-day.js";

const CUTOFF_KEY = "schulblick.dayCutoffHour";
const GRADE_CHART_KEY = "schulblick.gradeChart";
const GRADE_CHART_OPTIONS = ["bar", "donut"];
const DEFAULT_GRADE_CHART = "bar";
const GRADE_UNIT_KEY = "schulblick.gradeUnit";
const GRADE_UNIT_OPTIONS = ["points", "notes"];
const DEFAULT_GRADE_UNIT = "points";
// ACCENT_KEY and ACCENT_OPTIONS are duplicated in /theme-init.js; keep them in sync.
const ACCENT_KEY = "schulblick.accent";
const ACCENT_OPTIONS = ["rost", "pflaume", "gruen", "petrol"];
const DEFAULT_ACCENT = "rost";

/** The cutoff hour for "Heute"; anything not on the offered list falls back. */
export function getCutoffHour() {
  try {
    const stored = Number(window.localStorage.getItem(CUTOFF_KEY));
    return CUTOFF_HOUR_OPTIONS.includes(stored) ? stored : DEFAULT_CUTOFF_HOUR;
  } catch {
    return DEFAULT_CUTOFF_HOUR;
  }
}

export function setCutoffHour(hour) {
  try {
    window.localStorage.setItem(CUTOFF_KEY, String(hour));
  } catch {
    // No storage: applies to this page load only.
  }
}

/** The Noten chart type: "bar" or "donut"; anything else falls back to "bar". */
export function getGradeChart() {
  return readChoice(GRADE_CHART_KEY, GRADE_CHART_OPTIONS, DEFAULT_GRADE_CHART);
}

export function setGradeChart(value) {
  writeSetting(GRADE_CHART_KEY, value);
}

/** Oberstufe charts in "points" (0–15) or converted to "notes" (1–6); default points. */
export function getGradeUnit() {
  return readChoice(GRADE_UNIT_KEY, GRADE_UNIT_OPTIONS, DEFAULT_GRADE_UNIT);
}

export function setGradeUnit(value) {
  writeSetting(GRADE_UNIT_KEY, value);
}

/** The accent palette, a [data-accent] in tokens.css; default Rost. */
export function getAccent() {
  return readChoice(ACCENT_KEY, ACCENT_OPTIONS, DEFAULT_ACCENT);
}

export function setAccent(value) {
  writeSetting(ACCENT_KEY, value);
}

/** A stored value if it is one of `options`, else the fallback. */
function readChoice(key, options, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    return options.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeSetting(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // No storage: applies to this page load only.
  }
}
