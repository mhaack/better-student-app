// Non-theme preferences. Not sensitive, so plain localStorage.
import { DEFAULT_CUTOFF_HOUR, CUTOFF_HOUR_OPTIONS } from "../domain/school-day.js";

const CUTOFF_KEY = "schulblick.dayCutoffHour";

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
