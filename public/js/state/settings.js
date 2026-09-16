// User preferences that aren't the theme. Plain localStorage — none of this
// is sensitive, so unlike the auth session there's no session/local split.
import { DEFAULT_CUTOFF_HOUR, CUTOFF_HOUR_OPTIONS } from "../domain/school-day.js";

const CUTOFF_KEY = "schulblick.dayCutoffHour";

/**
 * The hour after which "Heute" rolls forward to the next school day.
 * Falls back to the default for anything unset, unparseable or off the
 * offered list — a stored value from an older build shouldn't be able to
 * put the app in a state the settings UI can't show.
 */
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
    // Private browsing / storage disabled: the choice applies to this page
    // load, it just won't persist.
  }
}
