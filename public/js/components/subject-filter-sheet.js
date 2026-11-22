import { escapeHtml } from "../util/dom.js";
import { closeDetailSheet, mountSheet } from "./detail-sheet.js";

/** @typedef {{ subjectId: string | number, name: string, count: number }} FilterSubject */

const SEARCH_ICON =
  '<svg class="sf-search-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
const CHECK_ICON =
  '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16"><path d="M3.5 8.3l3 3 6-6.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The filter button's text: no filter, one or two names, or a count. */
export function subjectFilterLabel(selected, subjects) {
  if (!selected) return "Alle Fächer";
  const names = subjects.filter((s) => selected.has(s.subjectId)).map((s) => s.name);
  if (names.length === 0) return "Alle Fächer";
  return names.length <= 2 ? names.join(", ") : `${names.length} Fächer`;
}

/** Subjects without grades can't be chosen, so they never count as checked. */
export function selectableIds(subjects) {
  return subjects.filter((s) => s.count > 0).map((s) => s.subjectId);
}

/** The sheet's starting checkboxes: no filter means every selectable subject. */
export function initialDraft(selected, subjects) {
  const ids = selectableIds(subjects);
  return new Set(selected ? ids.filter((id) => selected.has(id)) : ids);
}

/** What applying the draft means for the filter: all checked is no filter. */
export function resolveDraft(draft, subjects) {
  const ids = selectableIds(subjects);
  const checked = ids.filter((id) => draft.has(id));
  return checked.length === ids.length ? null : new Set(checked);
}

/** The apply button: its text and whether it can be pressed. */
export function applyButtonState(draft, subjects) {
  const resolved = resolveDraft(draft, subjects);
  if (!resolved) return { label: "Alle Fächer anzeigen", disabled: false };
  const n = resolved.size;
  if (n === 0) return { label: "Mindestens ein Fach wählen", disabled: true };
  return { label: `${n} ${n === 1 ? "Fach" : "Fächer"} anzeigen`, disabled: false };
}

export function gradeCountLabel(count) {
  return `${count} ${count === 1 ? "Note" : "Noten"}`;
}

export function matchesSearch(name, query) {
  const q = query.trim().toLocaleLowerCase("de");
  return !q || name.toLocaleLowerCase("de").includes(q);
}

/**
 * The Fächer sheet: checkboxes per subject, applied only by the bottom button.
 * Closing any other way leaves the filter as it was.
 *
 * @param {HTMLElement} container
 * @param {{ subjects: FilterSubject[], selected: Set<FilterSubject["subjectId"]> | null,
 *   onApply: (selected: Set<FilterSubject["subjectId"]> | null) => void }} options
 */
export function openSubjectFilterSheet(container, { subjects, selected, onApply }) {
  const draft = initialDraft(selected, subjects);
  const rows = subjects.map((s, i) => subjectRow(s, i, draft.has(s.subjectId))).join("");

  const backdrop = mountSheet(container, {
    html: `
    <div class="detail-sheet sf-sheet" role="dialog" aria-modal="true" aria-labelledby="sf-title">
      <div class="detail-handle" aria-hidden="true"></div>
      <div class="sf-top">
        <h2 id="sf-title" class="detail-title sf-title">Fächer</h2>
        <button type="button" class="sf-all">Alle</button>
      </div>
      <label class="sf-search">${SEARCH_ICON}<input type="search" placeholder="Fach suchen" aria-label="Fach suchen" autocomplete="off"></label>
      <div class="sf-list">
        ${rows}
        <p class="sf-none" hidden>Kein Fach gefunden.</p>
      </div>
      <button type="button" class="button-primary sf-apply"></button>
    </div>`,
  });

  const boxes = [...backdrop.querySelectorAll(".sf-row input")];
  const apply = backdrop.querySelector(".sf-apply");
  const search = backdrop.querySelector(".sf-search input");

  function update() {
    const { label, disabled } = applyButtonState(draft, subjects);
    apply.textContent = label;
    apply.disabled = disabled;
  }

  backdrop.addEventListener("change", (e) => {
    const index = e.target.dataset?.index;
    if (index === undefined) return;
    const id = subjects[Number(index)].subjectId;
    if (e.target.checked) draft.add(id);
    else draft.delete(id);
    update();
  });

  backdrop.querySelector(".sf-all").addEventListener("click", () => {
    for (const id of selectableIds(subjects)) draft.add(id);
    for (const box of boxes) box.checked = !box.disabled;
    update();
  });

  search.addEventListener("input", () => {
    let shown = 0;
    for (const box of boxes) {
      const match = matchesSearch(subjects[Number(box.dataset.index)].name, search.value);
      box.closest(".sf-row").hidden = !match;
      if (match) shown++;
    }
    backdrop.querySelector(".sf-none").hidden = shown > 0;
  });

  apply.addEventListener("click", () => {
    onApply(resolveDraft(draft, subjects));
    closeDetailSheet(container);
  });

  update();
  search.focus({ preventScroll: true });
}

function subjectRow(subject, index, checked) {
  const disabled = subject.count === 0;
  return `
    <label class="sf-row${disabled ? " is-disabled" : ""}">
      <input type="checkbox" data-index="${index}"${checked ? " checked" : ""}${disabled ? " disabled" : ""}>
      <span class="sf-box">${CHECK_ICON}</span>
      <span class="sf-name">${escapeHtml(subject.name)}</span>
      <span class="sf-count">${gradeCountLabel(subject.count)}</span>
    </label>`;
}
