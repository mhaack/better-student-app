import { escapeHtml } from "../util/dom.js";
import { mountSheet, detailRow } from "./detail-sheet.js";

const WEEKDAY_SHORT = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("de-DE", { weekday: "long" });

function localDate(iso) {
  return new Date(`${iso}T00:00:00`);
}

function dayMonth(date) {
  return `${date.getDate()}.${date.getMonth() + 1}.`;
}

/**
 * The test sheet, one block per exam (all on the same day). Exams carry the
 * fields `attachExams` adds: countdown, timeLabel, room, teacher.
 */
export function openExamSheet(container, exams, opener) {
  const blocks = exams
    .map((exam, i) => {
      const date = localDate(exam.date);
      return `
      <section class="detail-block">
        <div class="detail-header">
          <div class="detail-header-text">
            ${exam.typeName ? `<div class="eyebrow">${escapeHtml(exam.typeName)}</div>` : ""}
            <h2 class="detail-title">${escapeHtml(exam.subject ?? exam.subjectShort ?? "")}</h2>
            <div class="exam-when">
              <span class="exam-pill">${escapeHtml(exam.countdown)}</span>
              <span class="exam-date">${escapeHtml(`${WEEKDAY_SHORT.format(date).replace(".", "")} ${dayMonth(date)}`)}</span>
            </div>
          </div>
          ${i === 0 ? `<button type="button" class="detail-close" aria-label="Schließen">✕</button>` : ""}
        </div>
        <div>
          ${detailRow("Thema", exam.text)}
          ${detailRow("Zeit", exam.timeLabel)}
          ${detailRow("Raum", [exam.room, exam.teacher].filter(Boolean).join(" · "))}
        </div>
      </section>`;
    })
    .join("");

  const first = localDate(exams[0].date);
  const title = `${exams.length === 1 ? "Test" : "Tests"} am ${WEEKDAY_LONG.format(first)} ${dayMonth(first)}`;
  mountSheet(container, {
    opener,
    html: `
      <div class="detail-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="detail-handle" aria-hidden="true"></div>
        ${blocks}
      </div>`,
  });
}
