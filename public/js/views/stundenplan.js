import { getSelectedStudentId, getStudents } from "../state/auth-store.js";
import { getStundenplanData } from "../data/stundenplan.js";
import { escapeHtml } from "../util/dom.js";
import { renderSkeleton, renderErrorState, bindErrorState } from "../components/states.js";

const STATUS_EYEBROW = {
  cancelled: "Entfällt",
  room_change: "Raumänderung",
  substitution: "Vertretung",
  changed: "Geändert",
};

/**
 * The full-detail breakdown for the tap-to-open sheet: what changed (room,
 * teacher) shown as "vorher → nachher" where a diff is known, plain current
 * values otherwise, plus any free-text note the school attached.
 */
function describeChange(lesson) {
  const eyebrow = STATUS_EYEBROW[lesson.status] ?? "Geändert";
  const rows = [];

  if (lesson.status === "room_change" && lesson.previousRoom) {
    rows.push({ label: "Raum", value: `${lesson.previousRoom} → ${lesson.room ?? "–"}` });
  } else if (lesson.room) {
    rows.push({ label: "Raum", value: lesson.room });
  }

  if (lesson.status === "substitution" && (lesson.previousTeacher || lesson.previousTeacherShort)) {
    const prev = lesson.previousTeacher ?? lesson.previousTeacherShort;
    const next = lesson.teacher ?? lesson.teacherShort ?? "–";
    rows.push({ label: "Lehrkraft", value: `${prev} → ${next}` });
  } else if (lesson.teacher) {
    rows.push({ label: "Lehrkraft", value: lesson.teacher });
  }

  return { eyebrow, rows, note: lesson.notes?.[0] };
}

function cellContent(lesson, dayIndex) {
  if (!lesson) return "";

  let classes = "sp-cell";
  let title;
  let titleStyle = "";
  // Room and teacher get their own line each; only their content changes
  // per status (a substitution shows the teacher swap instead of the plain
  // current teacher, cancelled has no room to anchor a teacher line to).
  let roomLine = lesson.room ?? "";
  let teacherLine = lesson.teacherShort ?? "";

  if (lesson.status === "cancelled") {
    classes += " sp-cell--cancelled";
    titleStyle = "text-decoration:line-through";
    title = lesson.subjectShort ?? "";
    roomLine = "entfällt";
    teacherLine = "";
  } else if (lesson.status === "room_change") {
    classes += " sp-cell--changed";
    title = `→ ${lesson.subjectShort ?? ""}`;
  } else if (lesson.status === "substitution") {
    classes += " sp-cell--changed";
    title = `± ${lesson.subjectShort ?? ""}`;
    // The teacher swap is the point of this cell; fall back to the plain
    // current short code if either side's is missing.
    teacherLine =
      lesson.previousTeacherShort && lesson.teacherShort
        ? `${lesson.previousTeacherShort} → ${lesson.teacherShort}`
        : lesson.teacherShort ?? "";
  } else if (lesson.status === "changed") {
    // The school published an amended plan for this period, but neither the
    // room nor the teacher on record actually differs (usually a note like
    // "Aufgaben von Frau X im Raum bearbeiten") — flag it without claiming
    // a specific substitution or room change that didn't happen. The note,
    // when there is one, is more useful here than the unchanged room.
    classes += " sp-cell--changed";
    title = lesson.subjectShort ?? "";
    if (lesson.notes?.[0]) roomLine = lesson.notes[0];
  } else {
    title = lesson.subjectShort ?? "";
  }

  const inner = `
    <div class="sp-cell-title" style="${titleStyle}">${escapeHtml(title)}</div>
    <div class="sp-cell-meta">${escapeHtml(roomLine)}</div>
    ${teacherLine ? `<div class="sp-cell-meta">${escapeHtml(teacherLine)}</div>` : ""}`;

  if (lesson.status === "regular") {
    return `<div class="${classes}">${inner}</div>`;
  }

  // Only changed periods open the detail sheet — a regular lesson has
  // nothing more to say than what's already in the cell.
  const label = `${lesson.subject ?? lesson.subjectShort ?? ""}, ${STATUS_EYEBROW[lesson.status] ?? "Geändert"}`;
  return `
    <button type="button" class="${classes}" data-day-index="${dayIndex}" data-period="${lesson.period}" aria-label="${escapeHtml(label)}">
      ${inner}
    </button>`;
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
  const cells = row.cells
    .map((lesson, dayIndex) => `<div class="sp-grid-cell">${cellContent(lesson, dayIndex)}</div>`)
    .join("");
  return `<div class="sp-grid-row"><div class="sp-period">${row.period}</div>${cells}</div>`;
}

function closeLessonDetail(container) {
  container.querySelector("#sp-detail-backdrop")?.remove();
}

function openLessonDetail(container, day, lesson) {
  closeLessonDetail(container);

  const { eyebrow, rows, note } = describeChange(lesson);
  const rowsHtml = rows
    .map(
      (r) => `
      <div class="sp-detail-row">
        <span class="sp-detail-label">${escapeHtml(r.label)}</span>
        <span>${escapeHtml(r.value)}</span>
      </div>`
    )
    .join("");

  const backdrop = document.createElement("div");
  backdrop.className = "sp-detail-backdrop";
  backdrop.id = "sp-detail-backdrop";
  backdrop.innerHTML = `
    <div class="sp-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="sp-detail-title">
      <div class="sp-detail-header">
        <div>
          <div class="eyebrow" style="color:var(--accent)">${escapeHtml(eyebrow)}</div>
          <h2 id="sp-detail-title" class="sp-detail-title" style="${lesson.status === "cancelled" ? "text-decoration:line-through" : ""}">${escapeHtml(lesson.subject ?? lesson.subjectShort ?? "")}</h2>
          <div class="view-subtitle">${escapeHtml(day.label)}, ${escapeHtml(day.dateLabel)} · ${lesson.period}. Stunde</div>
        </div>
        <button type="button" class="sp-detail-close" aria-label="Schließen">✕</button>
      </div>
      ${rowsHtml}
      ${note ? `<div class="sp-detail-note">${escapeHtml(note)}</div>` : ""}
    </div>`;
  container.appendChild(backdrop);

  function onKeydown(e) {
    if (e.key === "Escape") backdrop.remove();
  }
  document.addEventListener("keydown", onKeydown);

  // Tears the Escape listener down whenever the backdrop leaves the DOM —
  // via its own close button/backdrop click/Escape, or via closeLessonDetail
  // navigating weeks, or (the leak this fixes) the whole view being
  // replaced by a route change, which resets #view-container's innerHTML
  // without ever calling any of the above. Covering every removal path
  // through one observer is simpler than threading cleanup through each.
  const observer = new MutationObserver(() => {
    if (backdrop.isConnected) return;
    document.removeEventListener("keydown", onKeydown);
    observer.disconnect();
  });
  observer.observe(container, { childList: true });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  backdrop.querySelector(".sp-detail-close").addEventListener("click", () => backdrop.remove());
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
  // The days array from the most recent successful load, so the click
  // delegate below can look up a cell's full lesson data without stuffing
  // it into data attributes.
  let currentDays = [];
  // Bumped on every load; loadAndRender drops its result if a newer one has
  // since started, so a slow response to an earlier week can't overwrite a
  // faster one to a later week that was requested after it.
  const loadState = { seq: 0 };

  const prevBtn = container.querySelector("#sp-prev");
  const nextBtn = container.querySelector("#sp-next");

  function goToWeek(offset) {
    const clamped = Math.max(0, Math.min(MAX_WEEK_OFFSET, offset));
    if (clamped === weekOffset) return;
    weekOffset = clamped;
    closeLessonDetail(container);
    loadAndRender(container, studentId, student, weekOffset, loadState).then((days) => {
      if (days) currentDays = days;
    });
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

  // One delegated listener survives every #sp-body re-render, same as the
  // swipe listeners above.
  body.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-period]");
    if (!btn) return;
    const day = currentDays[Number(btn.dataset.dayIndex)];
    const lesson = day?.lessons.find((l) => l.period === Number(btn.dataset.period));
    if (day && lesson) openLessonDetail(container, day, lesson);
  });

  currentDays = (await loadAndRender(container, studentId, student, weekOffset, loadState)) ?? [];
}

/**
 * Returns the loaded days, or null if a newer call (a later week request)
 * started before this one's fetch resolved — the caller should then leave
 * whatever that newer call already rendered alone instead of overwriting it
 * with this stale result.
 */
async function loadAndRender(container, studentId, student, weekOffset, loadState) {
  const seq = ++loadState.seq;
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
    if (loadState.seq !== seq) return null;

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
    return data.days;
  } catch (err) {
    if (loadState.seq !== seq) return null;
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
    return [];
  }
}
