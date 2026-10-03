import { getSelectedStudentId, getStudents } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getHeuteData } from "../data/heute.js";
import { getMitteilungenData } from "../data/mitteilungen.js";
import { mitteilungRow } from "./mitteilungen.js";
import { escapeHtml } from "../util/dom.js";
import { weekdayOrDate, daysUntil } from "../util/format.js";
import { renderSkeleton, renderErrorState, bindErrorState } from "../components/states.js";
import { openDetailSheet, bindActivate, markTruncatedRows } from "../components/detail-sheet.js";
import { openExamSheet } from "../components/exam-sheet.js";

const STATUS_PILL = {
  room_change: '<span class="pill pill--room">→ Raum</span>',
  substitution: '<span class="pill pill--room">± Vertretung</span>',
  cancelled: '<span class="pill pill--cancel">entfällt</span>',
};

/** "218 → 206" for a moved lesson, otherwise just where it is. */
function lessonMeta(lesson) {
  if (lesson.status === "room_change" && lesson.previousRoom && lesson.room) {
    return `${lesson.previousRoom} → ${lesson.room}`;
  }
  return lesson.room ?? lesson.teacher ?? "";
}

function lessonRow(lesson) {
  const isCancelled = lesson.status === "cancelled";
  return `
    <div class="lesson-row">
      <div class="lesson-period">${escapeHtml(lesson.period)}</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <div class="${isCancelled ? "lesson-subject lesson-subject--cancelled" : "lesson-subject"}">${escapeHtml(lesson.subject ?? "–")}</div>
        <div class="lesson-meta">${escapeHtml(lessonMeta(lesson))}</div>
      </div>
      ${STATUS_PILL[lesson.status] ?? "<span></span>"}
    </div>`;
}

function changesCard(changes) {
  if (changes.length === 0) return "";
  const rows = changes
    .map((c) => {
      const cancelled = c.status === "cancelled";
      return `
      <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:${cancelled ? "var(--text-secondary)" : "var(--text-primary)"}">
        <span style="width:20px;text-align:center;${cancelled ? "" : "color:var(--accent)"}">${cancelled ? "✕" : "→"}</span>
        ${cancelled ? `<span style="text-decoration:line-through">${escapeHtml(c.label)}</span> entfällt` : escapeHtml(c.text)}
      </div>`;
    })
    .join("");
  return `
    <div class="card card--accent" style="display:flex;flex-direction:column;gap:8px">
      <div class="card-row">
        <span class="eyebrow" style="color:var(--accent)">Änderungen heute</span>
        <span style="font-family:var(--font-serif);font-size:20px;color:var(--accent)">${changes.length}</span>
      </div>
      ${rows}
    </div>`;
}

function newGradeSection(grade) {
  if (!grade) return "";
  return `
    <div class="section" style="gap:12px">
      <div class="eyebrow">Letzte Note</div>
      <div class="card-row" style="min-height:48px">
        <div>
          <div style="font-size:16px;color:var(--text-primary);font-weight:500">${escapeHtml(grade.subjectName ?? "")}</div>
          <div style="font-size:13px;color:var(--text-muted)">${escapeHtml(grade.collection?.name || grade.collection?.type || "")}</div>
        </div>
        <span class="grade-capsule grade-capsule--new">${escapeHtml(grade.raw)}</span>
      </div>
    </div>`;
}

/** Klassenbuch entries of the next two weeks; each row names its type. */
function notesSection(items) {
  if (items.length === 0) return "";
  const rows = items
    .map((n, index) => {
      // Due today or tomorrow: accent pill.
      const isUrgent = (daysUntil(n.date) ?? 99) <= 1;
      const dueLabel = escapeHtml(weekdayOrDate(n.date));
      const due = isUrgent
        ? `<span class="pill pill--room">${dueLabel}</span>`
        : `<span class="hw-due">${dueLabel}</span>`;
      return `
      <div class="hw-row${n.isExam ? " is-expandable" : ""}" data-note-index="${index}"${n.isExam ? ' role="button" tabindex="0"' : ""}>
        <div class="hw-text">
          <div class="hw-title">${escapeHtml([n.subject, n.text].filter(Boolean).join(" · "))}</div>
          ${n.typeName ? `<div class="hw-type">${escapeHtml(n.typeName)}</div>` : ""}
        </div>
        ${due}
      </div>`;
    })
    .join("");
  return `
    <div class="section" style="gap:10px">
      <div class="eyebrow">Anstehend</div>
      ${rows}
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
    <div class="section" style="gap:10px">
      <div class="eyebrow">Mitteilungen</div>
      <div class="mt-list">${fresh.map((item) => mitteilungRow(item, weekdayOrDate(item.date))).join("")}</div>
    </div>`;
}

/** The full entry behind a clamped Anstehend row that isn't a test. */
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
    const students = getStudents();
    const student = students.find((s) => s.id === studentId);
    const { scale } = await ensureContext();
    const data = await getHeuteData(studentId, scale);

    const klasse = student?.className ?? "";
    // After the cutoff this shows the next school day; say which.
    container.querySelector("#heute-title").textContent = data.title;
    container.querySelector("#heute-subtitle").textContent = `${data.dateLabel}${klasse ? ` · ${klasse}` : ""}`;

    const body = container.querySelector("#heute-body");
    body.innerHTML = `
      ${changesCard(data.changes)}
      <div class="section">
        <div class="eyebrow">Stundenplan</div>
        <div class="lesson-list">
          ${data.lessons.length ? data.lessons.map(lessonRow).join("") : '<div class="empty-state">Heute keine Stunden.</div>'}
        </div>
      </div>
      ${newGradeSection(data.newestGrade)}
      ${notesSection(data.notes)}
      <div id="heute-mitteilungen" hidden></div>
    `;
    fillMitteilungen(container);
    markTruncatedRows(body, "[data-note-index]", ".hw-title");
    bindActivate(body, "[data-note-index]", (row) => {
      const note = data.notes[Number(row.dataset.noteIndex)];
      if (note?.isExam) openExamSheet(container, [note], row);
      else if (note) openNoteDetail(container, note);
    });
  } catch (err) {
    container.querySelector("#heute-body").innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}
