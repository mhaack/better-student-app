import { escapeHtml } from "../util/dom.js";

const BACKDROP_ID = "detail-sheet-backdrop";

export function closeDetailSheet(container) {
  container.querySelector(`#${BACKDROP_ID}`)?.remove();
}

/**
 * The bottom sheet behind every tap-for-details in the app: a changed
 * Stundenplan cell, a truncated Termin or Anstehend entry. All text is
 * escaped here, so callers pass plain API strings.
 *
 * @param {HTMLElement} container the view container the sheet mounts into
 * @param {{ eyebrow?: string, title: string, titleStyle?: string,
 *   subtitle?: string, rows?: {label: string, value: string}[], note?: string }} content
 */
export function openDetailSheet(container, { eyebrow, title, titleStyle = "", subtitle, rows = [], note }) {
  closeDetailSheet(container);

  const rowsHtml = rows
    .map(
      (r) => `
      <div class="detail-row">
        <span class="detail-label">${escapeHtml(r.label)}</span>
        <span>${escapeHtml(r.value)}</span>
      </div>`
    )
    .join("");

  const backdrop = document.createElement("div");
  backdrop.className = "detail-backdrop";
  backdrop.id = BACKDROP_ID;
  backdrop.innerHTML = `
    <div class="detail-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-sheet-title">
      <div class="detail-header">
        <div>
          ${eyebrow ? `<div class="eyebrow" style="color:var(--accent)">${escapeHtml(eyebrow)}</div>` : ""}
          <h2 id="detail-sheet-title" class="detail-title" style="${titleStyle}">${escapeHtml(title)}</h2>
          ${subtitle ? `<div class="view-subtitle">${escapeHtml(subtitle)}</div>` : ""}
        </div>
        <button type="button" class="detail-close" aria-label="Schließen">✕</button>
      </div>
      ${rowsHtml}
      ${note ? `<div class="detail-note">${escapeHtml(note)}</div>` : ""}
    </div>`;
  container.appendChild(backdrop);

  function onKeydown(e) {
    if (e.key === "Escape") backdrop.remove();
  }
  document.addEventListener("keydown", onKeydown);

  // Tears the Escape listener down whenever the backdrop leaves the DOM —
  // via its own close button/backdrop click/Escape, via closeDetailSheet,
  // or via the whole view being replaced by a route change, which resets
  // #view-container's innerHTML without ever calling any of the above.
  // Covering every removal path through one observer is simpler than
  // threading cleanup through each.
  const observer = new MutationObserver(() => {
    if (backdrop.isConnected) return;
    document.removeEventListener("keydown", onKeydown);
    observer.disconnect();
  });
  observer.observe(container, { childList: true });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  backdrop.querySelector(".detail-close").addEventListener("click", () => backdrop.remove());
}

/**
 * Wires tap and keyboard activation for `[role="button"]` descendants of
 * `root` that match `selector`, via delegated listeners that survive
 * re-renders of root's innerHTML. The targets are divs, not real buttons —
 * WebKit's native button content wrapper ignores appearance:none and
 * vertically centers short content — so Enter/Space are wired by hand:
 * Enter on keydown (ignoring OS key-repeat), Space on keyup, same as a
 * native button.
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
 * Makes each `rowSelector` element under root tappable only when its
 * `clampSelector` child is actually cut off by its line clamp. Whether a
 * text overflows depends on the screen width, so this is measured after
 * rendering rather than guessed from a character count — a row whose text
 * fits in full has nothing more to show.
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
  // The serif/sans web fonts can land after the first render and change
  // where lines break, so measure once more when they have.
  document.fonts?.ready.then(mark);
}
