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

// Swipe forward up to 3 weeks past the default (today's/next week) — 4
// navigable weeks in total.
const MAX_WEEK_OFFSET = 3;
const SWIPE_THRESHOLD_PX = 50;

function weekLabelFor(weeksFromNow) {
  if (weeksFromNow === 0) return "in dieser Woche";
  if (weeksFromNow === 1) return "in der kommenden Woche";
  return `in ${weeksFromNow} Wochen`;
}

export async function renderStundenplan(container) {
  container.innerHTML = `
    <div class="view">
      <div>
        <h1 class="view-title">Stundenplan</h1>
        <div class="sp-week-nav">
          <button type="button" class="sp-week-nav-btn" id="sp-prev" aria-label="Vorherige Woche">‹</button>
          <div class="view-subtitle" id="sp-subtitle">…</div>
          <button type="button" class="sp-week-nav-btn" id="sp-next" aria-label="Nächste Woche">›</button>
        </div>
      </div>
      <div id="sp-body" class="view-body">${renderSkeleton(6)}</div>
    </div>`;

  const studentId = getSelectedStudentId();
  const student = getStudents().find((s) => s.id === studentId);

  // Resets to 0 on every fresh mount — the screen always opens on the
  // current week, never a previous session's navigation.
  let weekOffset = 0;

  const prevBtn = container.querySelector("#sp-prev");
  const nextBtn = container.querySelector("#sp-next");

  function goToWeek(offset) {
    const clamped = Math.max(0, Math.min(MAX_WEEK_OFFSET, offset));
    if (clamped === weekOffset) return;
    weekOffset = clamped;
    loadAndRender(container, studentId, student, weekOffset);
  }

  prevBtn.addEventListener("click", () => goToWeek(weekOffset - 1));
  nextBtn.addEventListener("click", () => goToWeek(weekOffset + 1));

  // Swipe left → next week, swipe right → previous week. Listeners are
  // attached once to the body node, which survives across re-renders
  // (only its innerHTML is replaced), so this doesn't need to be redone
  // per load.
  const body = container.querySelector("#sp-body");
  let touchStartX = null;
  let touchStartY = null;
  body.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true }
  );
  body.addEventListener(
    "touchend",
    (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      touchStartX = null;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
      goToWeek(dx < 0 ? weekOffset + 1 : weekOffset - 1);
    },
    { passive: true }
  );

  await loadAndRender(container, studentId, student, weekOffset);
}

async function loadAndRender(container, studentId, student, weekOffset) {
  const body = container.querySelector("#sp-body");
  body.innerHTML = renderSkeleton(6);

  const prevBtn = container.querySelector("#sp-prev");
  const nextBtn = container.querySelector("#sp-next");
  // visibility (not display) so the subtitle doesn't shift when an arrow
  // disappears at either end of the navigable range.
  prevBtn.disabled = weekOffset === 0;
  prevBtn.style.visibility = weekOffset === 0 ? "hidden" : "visible";
  nextBtn.disabled = weekOffset === MAX_WEEK_OFFSET;
  nextBtn.style.visibility = weekOffset === MAX_WEEK_OFFSET ? "hidden" : "visible";

  try {
    const data = await getStundenplanData(weekOffset);

    const first = data.days[0];
    const last = data.days[data.days.length - 1];
    const klasse = student?.className ? ` · ${student.className}` : "";
    container.querySelector("#sp-subtitle").textContent =
      `${first.label} ${first.dateLabel} – ${last.label} ${last.dateLabel}${klasse}`;

    const weekLabel = weekLabelFor(data.weeksFromNow);
    const changesLine =
      data.changeCount > 0
        ? `<span style="color:var(--accent);font-weight:600">${data.changeCount} Änderung${data.changeCount === 1 ? "" : "en"}</span> · ${weekLabel}`
        : `Keine Änderungen ${weekLabel}`;

    body.innerHTML = `
      <div class="sp-grid">
        ${headerRow(data.days)}
        ${data.grid.map(gridRow).join("")}
      </div>
      <div style="font-size:12px;color:var(--text-muted)">${changesLine}</div>
    `;
  } catch (err) {
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}
