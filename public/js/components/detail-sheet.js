import { escapeHtml } from "../util/dom.js";

const BACKDROP_ID = "detail-sheet-backdrop";

export function closeDetailSheet(container) {
  container.querySelector(`#${BACKDROP_ID}`)?.remove();
}

/**
 * The standard detail sheet. All text is escaped here, so callers pass plain
 * API strings.
 *
 * @param {HTMLElement} container the view container the sheet mounts into
 * @param {{ eyebrow?: string, title: string, titleStyle?: string,
 *   subtitle?: string, rows?: {label: string, value: string}[], note?: string }} content
 */
export function openDetailSheet(container, { eyebrow, title, titleStyle = "", subtitle, rows = [], note }) {
  const rowsHtml = rows.map((r) => detailRow(r.label, r.value)).join("");

  mountSheet(container, {
    html: `
    <div class="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-sheet-title">
      <div class="detail-handle" aria-hidden="true"></div>
      <div class="detail-header">
        <div class="detail-header-text">
          ${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ""}
          <h2 id="detail-sheet-title" class="detail-title" style="${titleStyle}">${escapeHtml(title)}</h2>
          ${subtitle ? `<div class="detail-subtitle">${escapeHtml(subtitle)}</div>` : ""}
        </div>
        <button type="button" class="detail-close" aria-label="Schließen">✕</button>
      </div>
      ${rowsHtml ? `<div>${rowsHtml}</div>` : ""}
      ${note ? `<div class="detail-note">${escapeHtml(note)}</div>` : ""}
    </div>`,
  });
}

/** One label/value row; empty when there is no value. */
export function detailRow(label, value) {
  return value
    ? `<div class="detail-row"><span class="detail-label">${escapeHtml(label)}</span><span class="detail-value">${escapeHtml(value)}</span></div>`
    : "";
}

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';

/**
 * Mounts a sheet (`html` carries role="dialog"; callers escape their text):
 * closes on backdrop tap, Escape or `.detail-close`, traps focus, and hands
 * focus back to `opener` when it goes.
 *
 * @param {HTMLElement} container
 * @param {{ html: string, opener?: Element | null }} options
 * @returns {HTMLElement} the backdrop
 */
export function mountSheet(container, { html, opener = document.activeElement }) {
  closeDetailSheet(container);

  const backdrop = document.createElement("div");
  backdrop.className = "detail-backdrop";
  backdrop.id = BACKDROP_ID;
  backdrop.innerHTML = html;
  container.appendChild(backdrop);

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  function close() {
    if (!backdrop.isConnected || backdrop.classList.contains("is-closing")) return;
    if (reducedMotion) {
      backdrop.remove();
      return;
    }
    backdrop.classList.add("is-closing");
    backdrop.addEventListener("animationend", () => backdrop.remove(), { once: true });
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = [...backdrop.querySelectorAll(FOCUSABLE)];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (e.shiftKey && (document.activeElement === first || !backdrop.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !backdrop.contains(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  }
  document.addEventListener("keydown", onKeydown);

  // Also catches removal by a route change that never calls close().
  const observer = new MutationObserver(() => {
    if (backdrop.isConnected) return;
    document.removeEventListener("keydown", onKeydown);
    observer.disconnect();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  observer.observe(container, { childList: true });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop || e.target.closest(".detail-close")) close();
  });

  backdrop.querySelector(".detail-close")?.focus({ preventScroll: true });
  return backdrop;
}

/**
 * Delegated tap and keyboard activation for `[role="button"]` matches of
 * `selector`. They are divs because WebKit centers <button> content
 * regardless of CSS, so Enter (keydown) and Space (keyup) are wired by hand.
 */
export function bindActivate(root, selector, onActivate) {
  const target = (e) => e.target.closest(`${selector}[role="button"]`);
  root.addEventListener("click", (e) => {
    const el = target(e);
    if (el) onActivate(el);
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = target(e);
    if (!el) return;
    e.preventDefault();
    if (e.key === "Enter" && !e.repeat) onActivate(el);
  });
  root.addEventListener("keyup", (e) => {
    if (e.key !== " ") return;
    const el = target(e);
    if (el) onActivate(el);
  });
}

/**
 * Makes a row tappable only when its clamped text is actually cut off,
 * measured after rendering since it depends on the screen width.
 */
export function markTruncatedRows(root, rowSelector, clampSelector) {
  const mark = () => {
    for (const row of root.querySelectorAll(rowSelector)) {
      const clamped = row.querySelector(clampSelector);
      if (!clamped || clamped.scrollHeight <= clamped.clientHeight + 1) continue;
      row.setAttribute("role", "button");
      row.setAttribute("tabindex", "0");
      row.classList.add("is-expandable");
    }
  };
  mark();
  // Fonts loading later change line breaks; measure again.
  document.fonts?.ready.then(mark);
}
