import { escapeHtml } from "../util/dom.js";
import { countdownLabel, daysUntil } from "../util/format.js";

/** "heute" / "morgen" / "in 2 Tagen": countdownLabel, lower-cased for mid-line use. */
export function relativeDays(iso) {
  const days = daysUntil(iso);
  if (days === null) return "";
  const label = countdownLabel(days);
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** The dark "Als nächstes" card; `body` is trusted HTML below the head. */
export function nextCard(eyebrow, title, meta, body) {
  return `
    <div class="next-card">
      <div class="next-card-eyebrow">${escapeHtml(eyebrow)}</div>
      <div class="next-card-head">
        <div class="next-card-title">${escapeHtml(title)}</div>
        <div class="next-card-when">${escapeHtml(meta)}</div>
      </div>
      ${body}
    </div>`;
}
