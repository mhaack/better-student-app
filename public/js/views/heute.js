import { getSelectedStudentId, getStudents } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getHeuteData } from "../data/heute.js";
import { getMitteilungenData } from "../data/mitteilungen.js";
import { mitteilungRow } from "./mitteilungen.js";
import { escapeHtml } from "../util/dom.js";
import { weekdayOrDate, formatWeekdayDate, formatFullDate } from "../util/format.js";
import { newSticker, gradeValue } from "../components/grade-capsule.js";
import { renderSkeleton, renderErrorState, bindErrorState } from "../components/states.js";
import { openDetailSheet, bindActivate, markTruncatedRows } from "../components/detail-sheet.js";
import { openExamSheet } from "../components/exam-sheet.js";
import { openLessonSheet, lessonStatusLabel } from "../components/lesson-sheet.js";
import { categoryMarker, lessonMarkers } from "../components/marker.js";

const STATUS_PILL = {
  room_change: '<span class="pill pill--room">→ Raum</span>',
  substitution: '<span class="pill pill--room">± Vertretung</span>',
  cancelled: '<span class="pill pill--cancel">entfällt</span>',
};
// More rows go behind "+n weitere".
const MAX_GRADE_ROWS = 2;

/** The black card for a test today or tomorrow. */
function testCard(test) {
  if (!test) return "";
  const { exam } = test;
  return `
    <div class="heute-test" role="button" tabindex="0" data-test aria-label="${escapeHtml(`${test.label}: ${exam.subject ?? ""}`)}">
      <div class="eyebrow heute-test__label"><span class="heute-test__dot" aria-hidden="true"></span>${escapeHtml(test.label)}</div>
      <div class="heute-test__row">
        <div class="heute-test__subject">${escapeHtml(exam.subject ?? exam.subjectShort ?? "")}</div>
        ${test.where ? `<span class="heute-test__where">${escapeHtml(test.where)}</span>` : ""}
      </div>
      ${exam.text ? `<div class="heute-test__topic">${escapeHtml(exam.text)}</div>` : ""}
    </div>`;
}

/** Stand-in teacher and room for a Vertretung, otherwise the room. */
function lessonMeta(lesson) {
  if (lesson.status === "substitution") return [lesson.teacher, lesson.room].filter(Boolean).join(" · ");
  return lesson.room ?? lesson.teacher ?? "";
}

function lessonRow(lesson) {
  const status = lesson.status === "regular" ? "" : ` heute-lesson--${lesson.status === "cancelled" ? "cancelled" : "changed"}`;
  const label = [
    `${lesson.period}. Stunde, ${lesson.subject ?? lesson.subjectShort ?? ""}`,
    lessonStatusLabel(lesson),
    lesson.hasExam ? "Test" : "",
    lesson.homework?.length ? "Hausaufgabe fällig" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `
    <div class="heute-lesson${status}" role="button" tabindex="0" data-period="${lesson.period}" aria-label="${escapeHtml(label)}">
      <span class="heute-lesson__period">${escapeHtml(lesson.period)}</span>
      <span class="heute-lesson__main">
        <span class="heute-lesson__subject">${escapeHtml(lesson.subject ?? "–")}</span>
        ${lessonMarkers(lesson, "heute-lesson__marks")}
        <span class="heute-lesson__meta">${escapeHtml(lessonMeta(lesson))}</span>
      </span>
      ${STATUS_PILL[lesson.status] ?? "<span></span>"}
    </div>`;
}

function planSection(day, changeCount) {
  const rows = day.lessons.length
    ? day.lessons.map(lessonRow).join("")
    : '<div class="empty-state">Keine Stunden.</div>';
  const changes = changeCount ? `${changeCount} ${changeCount === 1 ? "Änderung" : "Änderungen"}` : "";
  return `
    <div class="section section--tight">
      <div class="heute-section-head">
        <span class="eyebrow">Stundenplan</span>
        ${changes ? `<span class="eyebrow heute-changes">${changes}</span>` : ""}
      </div>
      <div class="heute-lessons">${rows}</div>
    </div>`;
}

/** The grades of the newest entry day, one row each; the rest are a tap away. */
function gradesCard(latest) {
  if (!latest) return "";
  const rows = latest.grades
    .slice(0, MAX_GRADE_ROWS)
    .map((grade) => {
      // Same target as a subject row in the Noten tab.
      const href = grade.subjectId != null ? `#/noten/${encodeURIComponent(grade.subjectId)}` : "#/noten";
      const kind = grade.collection?.name || grade.collection?.type;
      return `
      <a class="heute-grade link-reset" href="${href}">
        ${newSticker(grade)}
        <span class="heute-grade__text">${escapeHtml(grade.subjectName ?? "")}${kind ? ` <span class="heute-grade__kind">· ${escapeHtml(kind)}</span>` : ""}</span>
        <span class="heute-grade__value">${escapeHtml(gradeValue(grade))}</span>
        <span class="heute-chevron" aria-hidden="true">›</span>
      </a>`;
    })
    .join("");
  const rest = latest.grades.length - MAX_GRADE_ROWS;
  const more =
    rest > 0
      ? `<a class="heute-grade heute-grade--more link-reset" href="#/noten">+${rest} weitere<span class="heute-chevron" aria-hidden="true">›</span></a>`
      : "";
  const heading = `${latest.grades.length === 1 ? "Letzte Note" : "Letzte Noten"} (vom ${formatFullDate(latest.date)})`;
  return `
    <div class="section section--tight">
      <div class="eyebrow">${escapeHtml(heading)}</div>
      <div class="heute-grades">${rows}${more}</div>
    </div>`;
}

/** The next Klassenbuch entries; the rest are a tap away in Termine. */
function termineSection(notes) {
  if (notes.length === 0) return "";
  const rows = notes
    .map(
      (n, index) => `
      <div class="heute-termin${n.isExam ? " is-expandable" : ""}" data-note-index="${index}"${n.isExam ? ' role="button" tabindex="0"' : ""}>
        <div class="heute-termin__text">
          <div class="heute-termin__subject">${escapeHtml(n.subject ?? n.typeName ?? "")}</div>
          <div class="heute-termin__kind">${categoryMarker(n.category, "marker--lead")}${escapeHtml(n.text || n.typeName || "")}</div>
        </div>
        <span class="heute-termin__when">${escapeHtml(formatWeekdayDate(n.date))}</span>
      </div>`
    )
    .join("");
  return `
    <div class="section section--tight">
      <div class="heute-section-head">
        <span class="eyebrow">Termine</span>
        <a class="heute-link" href="#/termine">Alle Termine ›</a>
      </div>
      <div>${rows}</div>
    </div>`;
}

/** New announcements, last and loaded separately so a failure only drops them. */
async function fillMitteilungen(container) {
  let fresh;
  try {
    ({ fresh } = await getMitteilungenData());
  } catch {
    return;
  }
  const slot = container.querySelector("#heute-mitteilungen");
  if (!slot || fresh.length === 0) return;
  slot.outerHTML = `
    <div class="section section--tight">
      <div class="eyebrow">Mitteilungen</div>
      <div class="mt-list">${fresh.map((item) => mitteilungRow(item, weekdayOrDate(item.date))).join("")}</div>
    </div>`;
}

/** The full entry behind a Termine row that isn't a test. */
function openNoteDetail(container, note) {
  openDetailSheet(container, {
    eyebrow: note.typeName,
    title: note.subject ?? "",
    subtitle: [weekdayOrDate(note.date), note.periodLabel].filter(Boolean).join(" · "),
    note: note.text,
  });
}

export async function renderHeute(container) {
  container.innerHTML = `
    <div class="view">
      <div>
        <h1 class="view-title" id="heute-title">Heute</h1>
        <div class="view-subtitle" id="heute-subtitle">…</div>
      </div>
      <div id="heute-body" class="view-body">${renderSkeleton()}</div>
    </div>`;

  try {
    const studentId = getSelectedStudentId();
    const student = getStudents().find((s) => s.id === studentId);
    const { scale } = await ensureContext();
    const data = await getHeuteData(studentId, scale);

    const klasse = student?.className ?? "";
    // After the cutoff this shows the next school day; say which.
    container.querySelector("#heute-title").textContent = data.title;
    container.querySelector("#heute-subtitle").textContent = `${data.dateLabel}${klasse ? ` · ${klasse}` : ""}`;

    const body = container.querySelector("#heute-body");
    body.innerHTML = `
      ${testCard(data.test)}
      ${planSection(data.day, data.changeCount)}
      ${gradesCard(data.latestGrades)}
      ${termineSection(data.termine)}
      <div id="heute-mitteilungen" hidden></div>
    `;
    fillMitteilungen(container);
    markTruncatedRows(body, "[data-note-index]", ".heute-termin__kind");
    bindActivate(body, "[data-test]", (card) => openExamSheet(container, [data.test.exam], card));
    bindActivate(body, "[data-period]", (row) => {
      const lesson = data.day.lessons.find((l) => l.period === Number(row.dataset.period));
      if (lesson) openLessonSheet(container, data.day, lesson, row);
    });
    bindActivate(body, "[data-note-index]", (row) => {
      const note = data.termine[Number(row.dataset.noteIndex)];
      if (note?.isExam) openExamSheet(container, [note], row);
      else if (note) openNoteDetail(container, note);
    });
  } catch (err) {
    container.querySelector("#heute-body").innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}
