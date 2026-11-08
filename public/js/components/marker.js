// The app's one marker for Termine kinds: a filled dot for Klassenarbeiten and
// tests, a ring for homework, nothing for the rest. The shape tells them apart,
// not the colour, since red also means "changed".

const MARKER_CLASS = { exam: "marker marker--dot", hw: "marker marker--ring" };

/**
 * The marker for a Termine category ("exam", "hw"); empty for anything else.
 * `extraClass` places it, e.g. "marker--lead" in front of text.
 */
export function categoryMarker(category, extraClass = "") {
  const markerClass = MARKER_CLASS[category];
  if (!markerClass) return "";
  return `<span class="${markerClass}${extraClass ? ` ${extraClass}` : ""}" aria-hidden="true"></span>`;
}
