import { getSelectedStudentId, getStudents } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getHeuteData } from "../data/heute.js";
import { escapeHtml } from "../util/dom.js";
import { weekdayOrDate } from "../util/format.js";
import { renderSkeleton, renderErrorState } from "../components/states.js";

const STATUS_PILL = {
  room_change: '<span class="pill pill--room">→ Raum</span>',
  substitution: '<span class="pill pill--room">± Vertretung</span>',
  cancelled: '<span class="pill pill--cancel">entfällt</span>',
};

function lessonRow(lesson) {
  const isCancelled = lesson.status === "cancelled";
  return `
    <div class="lesson-row">
      <div class="lesson-period">${escapeHtml(lesson.period)}</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        <div class="${isCancelled ? "lesson-subject lesson-subject--cancelled" : "lesson-subject"}">${escapeHtml(lesson.subject ?? "–")}</div>
        <div class="lesson-meta">${escapeHtml(lesson.room ?? lesson.teacher ?? "")}</div>
      </div>
      ${STATUS_PILL[lesson.status] ?? "<span></span>"}
    </div>`;
}

function changesCard(changes) {
  if (changes.length === 0) return "";
  const rows = changes
    .map(
      (c) => `
      <div style="display:flex;align-items:center;gap:10px;font-size:14px;color:var(--text-primary)">
        <span style="width:20px;text-align:center;color:${c.status === "cancelled" ? "var(--text-muted)" : "var(--accent)"}">${c.status === "cancelled" ? "✕" : "→"}</span>
        ${escapeHtml(c.text)}
      </div>`
    )
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
    <div class="section">
      <div class="eyebrow">Neue Note</div>
      <div class="card-row" style="min-height:48px">
        <div>
          <div style="font-size:16px;color:var(--text-primary);font-weight:500">${escapeHtml(grade.subjectName ?? "")}</div>
          <div style="font-size:13px;color:var(--text-muted)">${escapeHtml(grade.collection?.name || grade.collection?.type || "")}</div>
        </div>
        <span class="grade-capsule grade-capsule--new">${escapeHtml(grade.raw)}</span>
      </div>
    </div>`;
}

/**
 * Klassenbuch entries due in the next two weeks. The design called this
 * "Hausaufgaben", but the API models homework, announced tests and lesson
 * topics as one note type per school — so the heading stays generic and each
 * row names its own type ("Leistungskontrolle", "Hausaufgabe", …).
 */
function notesSection(items) {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (n) => `
      <div class="hw-row">
        <button class="hw-check" aria-checked="false" aria-label="Erledigt"></button>
        <div class="hw-text">
          <div>${escapeHtml(n.subject ?? "")} · ${escapeHtml(n.text)}</div>
          ${n.typeName ? `<div style="font-size:12px;color:var(--text-muted)">${escapeHtml(n.typeName)}</div>` : ""}
        </div>
        <span class="hw-due">${escapeHtml(weekdayOrDate(n.date))}</span>
      </div>`
    )
    .join("");
  return `
    <div class="section">
      <div class="eyebrow">Anstehend</div>
      ${rows}
    </div>`;
}

export async function renderHeute(container) {
  container.innerHTML = `
    <div class="view">
      <div>
        <h1 class="view-title">Heute</h1>
        <div class="view-subtitle" id="heute-subtitle">…</div>
      </div>
      <div id="heute-body">${renderSkeleton()}</div>
    </div>`;

  bindHomeworkCheckboxes(container);

  try {
    const studentId = getSelectedStudentId();
    const students = getStudents();
    const student = students.find((s) => s.id === studentId);
    const { scale } = await ensureContext();
    const data = await getHeuteData(studentId, scale);

    const klasse = student?.className ?? "";
    container.querySelector("#heute-subtitle").textContent = `${data.dateLabel}${klasse ? " · " + klasse : ""}`;

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
    `;
    bindHomeworkCheckboxes(container);
  } catch (err) {
    container.querySelector("#heute-body").innerHTML = renderErrorState(escapeHtml(err.message));
  }
}

function bindHomeworkCheckboxes(container) {
  container.querySelectorAll(".hw-check").forEach((box) => {
    box.addEventListener("click", () => {
      const checked = box.getAttribute("aria-checked") === "true";
      box.setAttribute("aria-checked", String(!checked));
    });
  });
}
