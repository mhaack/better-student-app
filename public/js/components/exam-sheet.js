import { escapeHtml } from "../util/dom.js";
import { formatDayMonth, formatWeekday } from "../util/format.js";
import { mountSheet, detailRow, infoCards, homeworkCard, whenLine } from "./detail-sheet.js";

/**
 * The test sheet, one block per exam (all on the same day). Exams carry the
 * fields `attachExams` adds: countdown, timeLabel, room, teacher. `homework`
 * is what's also due in a tapped lesson.
 */
export function openExamSheet(container, exams, opener, homework = []) {
  const blocks = exams
    .map((exam, i) => {
      return `
      <section class="detail-block">
        <div class="detail-header">
          <div class="detail-header-text">
            ${exam.typeName ? `<div class="eyebrow">${escapeHtml(exam.typeName)}</div>` : ""}
            <h2 class="detail-title">${escapeHtml(exam.subject ?? exam.subjectShort ?? "")}</h2>
            ${whenLine(exam.countdown, exam.date)}
          </div>
          ${i === 0 ? `<button type="button" class="detail-close" aria-label="Schließen">✕</button>` : ""}
        </div>
        <div>
          ${detailRow("Zeit", exam.timeLabel)}
          ${detailRow("Raum", exam.room)}
          ${detailRow("Lehrkraft", exam.teacher)}
        </div>
        ${infoCards([{ marker: "dot", eyebrow: "Thema", text: exam.text }])}
      </section>`;
    })
    .join("");

  const { date } = exams[0];
  const title = `${exams.length === 1 ? "Test" : "Tests"} am ${formatWeekday(date, "long")} ${formatDayMonth(date)}`;
  mountSheet(container, {
    opener,
    html: `
      <div class="detail-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="detail-handle" aria-hidden="true"></div>
        ${blocks}
        ${infoCards(homework.map(homeworkCard))}
      </div>`,
  });
}
