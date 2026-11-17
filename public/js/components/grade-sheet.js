// The slide-up card for acknowledging a new or changed grade: the app's detail
// sheet, with the design's NEU / GEÄNDERT grade block and the Kenntnisnahme.
import { escapeHtml } from "../util/dom.js";
import { formatWeekdayDate } from "../util/format.js";
import { gradeTypeLabel } from "../domain/grades.js";
import { detailRow, mountSheet } from "./detail-sheet.js";
import { gradeValue, noticeCapsule } from "./grade-capsule.js";

const CHECK_ICON =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const CONFIRM_LABEL = "Zur Kenntnis nehmen";

/** "Neue Note / Noch nicht von euch gesehen" or "Note geändert / vorher 3 → jetzt 8". */
function stateText(grade, role) {
  if (grade.isChanged) {
    const before = escapeHtml(gradeValue(grade.previous));
    const now = escapeHtml(gradeValue(grade));
    return `
      <div class="grade-sheet__state">Note geändert</div>
      <div class="grade-sheet__detail">vorher <s>${before}</s> → jetzt ${now}</div>`;
  }
  const unseen = role === "student" ? "Noch nicht gesehen" : "Noch nicht von euch gesehen";
  return `
    <div class="grade-sheet__state grade-sheet__state--new">Neue Note</div>
    <div class="grade-sheet__detail">${unseen}</div>`;
}

/**
 * The card's markup; all API text is escaped here.
 * @param {{ grade: object, subjectName: string, weighting: string, role: string | null }} content
 */
export function gradeSheetHtml({ grade, subjectName, weighting, role }) {
  const kind = grade.isChanged ? "changed" : "new";
  const eyebrow = [gradeTypeLabel(grade.collection?.type), formatWeekdayDate(grade.givenAt)].filter(Boolean).join(" · ");
  const title = grade.collection?.name || gradeTypeLabel(grade.collection?.type);
  const notice = grade.notice;
  const hint =
    role === "student"
      ? "Bestätigt in beste.schule, dass du die Note gesehen hast."
      : "Bestätigt in beste.schule, dass ihr die Note gesehen habt.";
  return `
    <div class="detail-sheet grade-sheet" role="dialog" aria-modal="true" aria-labelledby="detail-sheet-title">
      <div class="detail-handle" aria-hidden="true"></div>
      <div class="detail-header">
        <div class="detail-header-text">
          <div class="eyebrow">${escapeHtml(eyebrow)}</div>
          <h2 id="detail-sheet-title" class="detail-title">${escapeHtml(title)}</h2>
        </div>
        <button type="button" class="detail-close" aria-label="Schließen">✕</button>
      </div>
      <div class="grade-sheet__hero">
        ${noticeCapsule(grade, kind)}
        <div>${stateText(grade, role)}</div>
      </div>
      <div>
        ${detailRow("Fach", subjectName)}
        ${detailRow("Gewichtung", weighting)}
        ${detailRow("Lehrkraft", grade.teacher)}
        ${notice?.date ? detailRow(notice.label, formatWeekdayDate(notice.date)) : ""}
      </div>
      <div class="grade-sheet__actions">
        <button type="button" class="button-primary grade-sheet__confirm" data-acknowledge>${CHECK_ICON}<span>${CONFIRM_LABEL}</span></button>
        <p class="grade-sheet__hint" data-hint>${hint}</p>
        <button type="button" class="grade-sheet__later" data-later>Später</button>
      </div>
    </div>`;
}

/**
 * Opens the card. `onConfirm` sends the Kenntnisnahme and redraws the page
 * (which removes the card); if it throws, the card stays open with an error.
 */
export function openGradeSheet(container, content, { onConfirm, opener }) {
  const backdrop = mountSheet(container, { html: gradeSheetHtml(content), opener });
  const confirm = backdrop.querySelector("[data-acknowledge]");
  const label = confirm.querySelector("span");
  const hint = backdrop.querySelector("[data-hint]");

  backdrop.querySelector("[data-later]").addEventListener("click", () => {
    backdrop.querySelector(".detail-close").click();
  });
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    label.textContent = "Wird bestätigt…";
    try {
      await onConfirm();
    } catch {
      confirm.disabled = false;
      label.textContent = CONFIRM_LABEL;
      hint.textContent = "Konnte nicht bestätigt werden. Bitte später noch einmal versuchen.";
      hint.classList.add("grade-sheet__hint--error");
    }
  });
}
