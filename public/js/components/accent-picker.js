// Akzentfarbe: round swatches as a radio group (arrow keys move and select, one tab stop).
import { escapeHtml } from "../util/dom.js";
import { ICONS } from "./icons.js";

const ARROW_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * A settings row; each swatch carries its palette via data-accent, so its dot shows --a-accent.
 * @param {{ value: string, label: string }[]} options
 * @param {string} current
 */
export function accentPicker(options, current) {
  const selected = options.find((o) => o.value === current) ?? options[0];
  const swatches = options
    .map((o) => {
      const on = o === selected;
      return `<button type="button" role="radio" class="accent-swatch" data-accent="${escapeHtml(o.value)}" aria-label="${escapeHtml(o.label)}" aria-checked="${on}" tabindex="${on ? 0 : -1}"><span class="accent-swatch__dot" aria-hidden="true">${ICONS.check}</span></button>`;
    })
    .join("");
  return `
    <div class="settings-row settings-row--stacked">
      <span class="settings-row__head">
        <span class="settings-label">Akzentfarbe</span>
        <span class="accent-name" data-accent-name>${escapeHtml(selected.label)}</span>
      </span>
      <div class="accent-picker" role="radiogroup" aria-label="Akzentfarbe">${swatches}</div>
    </div>`;
}

/** Wires clicks and arrow keys; `onChange(value)` runs for every new choice. */
export function bindAccentPicker(root, onChange) {
  const group = root.querySelector(".accent-picker");
  const buttons = [...group.querySelectorAll('[role="radio"]')];

  function select(button, focus) {
    for (const b of buttons) {
      const on = b === button;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    if (focus) button.focus();
    root.querySelector("[data-accent-name]").textContent = button.getAttribute("aria-label");
    onChange(button.dataset.accent);
  }

  group.addEventListener("click", (e) => {
    const button = e.target.closest('[role="radio"]');
    if (button) select(button, false);
  });

  group.addEventListener("keydown", (e) => {
    const step = ARROW_STEP[e.key];
    const index = buttons.indexOf(e.target.closest('[role="radio"]'));
    if (!step || index === -1) return;
    e.preventDefault();
    select(buttons[(index + step + buttons.length) % buttons.length], true);
  });
}
