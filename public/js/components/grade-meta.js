import { escapeHtml } from "../util/dom.js";
import { formatFullDate } from "../util/format.js";

const SEPARATOR = '<span class="grade-entry-sep" aria-hidden="true">·</span>';
const READ_CHECK = '<span role="img" aria-label="von Eltern gelesen" title="Von Eltern gelesen">✓</span>';

/** "Klausur Mechanik · 13.10.26 · ✓": optional leading text, the date, the guardian read check. */
export function gradeMeta(grade, leading = []) {
  const parts = [
    ...leading.filter(Boolean).map(escapeHtml),
    grade.givenAt ? escapeHtml(formatFullDate(grade.givenAt)) : "",
    grade.readByGuardian ? READ_CHECK : "",
  ].filter(Boolean);
  return parts.length ? `<div class="grade-entry-meta">${parts.join(SEPARATOR)}</div>` : "";
}
