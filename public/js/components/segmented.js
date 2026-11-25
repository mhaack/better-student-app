// A row of toggle buttons with one pressed: Übersicht | Diagramm, Balken | Kreis, 0–15 P | 1–6.
import { escapeHtml } from "../util/dom.js";

/**
 * @param {{ value: string, label: string }[]} options
 * @param {string} current
 * @param {{ label: string, attr: string, modifier?: string }} config `attr` carries each option's value
 */
export function segmented(options, current, { label, attr, modifier = "" }) {
  const buttons = options
    .map(
      (o) =>
        `<button type="button" class="segmented-option" ${attr}="${escapeHtml(o.value)}" aria-pressed="${o.value === current}">${escapeHtml(o.label)}</button>`
    )
    .join("");
  return `<div class="segmented${modifier ? ` segmented--${modifier}` : ""}" role="group" aria-label="${escapeHtml(label)}">${buttons}</div>`;
}

/** Marks the button whose `attr` equals `value` as pressed, the others not. */
export function setPressed(root, attr, value) {
  for (const button of root.querySelectorAll(`[${attr}]`)) {
    button.setAttribute("aria-pressed", String(button.getAttribute(attr) === value));
  }
}
