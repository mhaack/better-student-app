import { getSelectedStudentId, getStudents } from "../state/auth-store.js";
import { getStundenplanData } from "../data/stundenplan.js";
import { escapeHtml } from "../util/dom.js";
import { renderSkeleton, renderErrorState, bindErrorState } from "../components/states.js";

function cellContent(lesson) {
  if (!lesson) return "";

  if (lesson.status === "cancelled") {
    return `
      <div class="sp-cell sp-cell--cancelled">
        <div class="sp-cell-title" style="text-decoration:line-through">${escapeHtml(lesson.subjectShort ?? "")}</div>
        <div class="sp-cell-meta">entfällt</div>
      </div>`;
  }

  if (lesson.status === "room_change") {
    return `
      <div class="sp-cell sp-cell--changed">
        <div class="sp-cell-title">→ ${escapeHtml(lesson.subjectShort ?? "")}</div>
        <div class="sp-cell-meta">${escapeHtml(lesson.room ?? "")}</div>
      </div>`;
  }

  if (lesson.status === "substitution") {
    // The teacher swap is the point of this cell; fall back to the room if
    // either side's short code is missing.
    const meta =
      lesson.previousTeacherShort && lesson.teacherShort
        ? `${lesson.previousTeacherShort} → ${lesson.teacherShort}`
        : lesson.room ?? "";
    return `
      <div class="sp-cell sp-cell--changed">
        <div class="sp-cell-title">± ${escapeHtml(lesson.subjectShort ?? "")}</div>
        <div class="sp-cell-meta">${escapeHtml(meta)}</div>
      </div>`;
  }

  if (lesson.status === "changed") {
    // The school published an amended plan for this period, but neither the
    // room nor the teacher on record actually differs (usually a note like
    // "Aufgaben von Frau X im Raum bearbeiten") — flag it without claiming
    // a specific substitution or room change that didn't happen.
    return `
      <div class="sp-cell sp-cell--changed">
        <div class="sp-cell-title">${escapeHtml(lesson.subjectShort ?? "")}</div>
        <div class="sp-cell-meta">${escapeHtml(lesson.notes?.[0] ?? lesson.room ?? "")}</div>
      </div>`;
  }

  return `
    <div class="sp-cell">
      <div class="sp-cell-title">${escapeHtml(lesson.subjectShort ?? "")}</div>
      <div class="sp-cell-meta">${escapeHtml(lesson.room ?? "")}</div>
    </div>`;
}

function headerRow(days) {
  const cells = days
    .map(
      (d) => `
      <div style="text-align:center;display:flex;flex-direction:column;gap:1px">
        <div class="sp-day-label${d.isToday ? " sp-day-label--today" : ""}">${escapeHtml(d.label)}</div>
        <div class="sp-day-date">${escapeHtml(d.dateLabel)}</div>
      </div>`
    )
    .join("");
  return `<div class="sp-grid-row"><span></span>${cells}</div>`;
}

function gridRow(row) {
  const cells = row.cells.map((lesson) => `<div class="sp-grid-cell">${cellContent(lesson)}</div>`).join("");
  return `<div class="sp-grid-row"><div class="sp-period">${row.period}</div>${cells}</div>`;
}

export async function renderStundenplan(container) {
  container.innerHTML = `
    <div class="view">
      <div>
        <h1 class="view-title">Stundenplan</h1>
        <div class="view-subtitle" id="sp-subtitle">…</div>
      </div>
      <div id="sp-body" class="view-body">${renderSkeleton(6)}</div>
    </div>`;

  try {
    const studentId = getSelectedStudentId();
    const student = getStudents().find((s) => s.id === studentId);
    const data = await getStundenplanData();

    const first = data.days[0];
    const last = data.days[data.days.length - 1];
    const klasse = student?.className ? ` · ${student.className}` : "";
    container.querySelector("#sp-subtitle").textContent =
      `${first.label} ${first.dateLabel} – ${last.label} ${last.dateLabel}${klasse}`;

    const weekLabel = data.isNextWeek ? "in der kommenden Woche" : "in dieser Woche";
    const changesLine =
      data.changeCount > 0
        ? `<span style="color:var(--accent);font-weight:600">${data.changeCount} Änderung${data.changeCount === 1 ? "" : "en"}</span> · ${weekLabel}`
        : `Keine Änderungen ${weekLabel}`;

    container.querySelector("#sp-body").innerHTML = `
      <div class="sp-grid">
        ${headerRow(data.days)}
        ${data.grid.map(gridRow).join("")}
      </div>
      <div style="font-size:12px;color:var(--text-muted)">${changesLine}</div>
    `;
  } catch (err) {
    container.querySelector("#sp-body").innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}
