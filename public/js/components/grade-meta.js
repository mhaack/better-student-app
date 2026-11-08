import { escapeHtml } from "../util/dom.js";
import { formatFullDate } from "../util/format.js";

const SEPARATOR = '<span class="grade-entry-sep" aria-hidden="true">·</span>';

/** "Klausur Mechanik · 13.10.26": optional leading text, then the date. */
export function gradeMeta(grade, leading = []) {
  const parts = [
    ...leading.filter(Boolean).map(escapeHtml),
    grade.givenAt ? escapeHtml(formatFullDate(grade.givenAt)) : "",
  ].filter(Boolean);
  return parts.length ? `<div class="grade-entry-meta">${parts.join(SEPARATOR)}</div>` : "";
}
