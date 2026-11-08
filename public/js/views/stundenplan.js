import { getSelectedStudentId, getStudents } from "../state/auth-store.js";
import { getStundenplanData } from "../data/stundenplan.js";
import { escapeHtml } from "../util/dom.js";
import { formatWeekday, periodLabel } from "../util/format.js";
import { renderSkeleton, renderErrorState, bindErrorState } from "../components/states.js";
import { openDetailSheet, closeDetailSheet, bindActivate, homeworkCard } from "../components/detail-sheet.js";
import { openExamSheet } from "../components/exam-sheet.js";
import { categoryMarker } from "../components/marker.js";

const STATUS_EYEBROW = {
  cancelled: "Entfällt",
  room_change: "Raumänderung",
  substitution: "Vertretung",
  changed: "Geändert",
};
// Up to 3 weeks ahead of the default week.
const MAX_WEEK_OFFSET = 3;
const SWIPE_THRESHOLD_PX = 50;

/** The tap-to-open sheet: time, changes as "vorher → nachher", plus the school's note. */
function describeLesson(lesson) {
  const eyebrow = lesson.status === "regular" ? undefined : (STATUS_EYEBROW[lesson.status] ?? "Geändert");
  const rows = [{ label: "Zeit", value: [periodLabel([lesson.period]), lesson.timeLabel].filter(Boolean).join(" · ") }];

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

/** Dot for a test, ring for homework; the shape tells them apart, not the colour. */
function markers(hasExam, hasHomework) {
  if (!hasExam && !hasHomework) return "";
  return `<span class="sp-marks">${hasExam ? categoryMarker("exam") : ""}${hasHomework ? categoryMarker("hw") : ""}</span>`;
}

function cellContent(lesson, day, dayIndex) {
  if (!lesson) return "";

  let classes = "sp-cell";
  let title;
  // One line each for room and teacher; the content depends on the status.
  let roomLine = lesson.room ?? "";
  let teacherLine = lesson.teacherShort ?? "";

  if (lesson.status === "cancelled") {
    classes += " sp-cell--cancelled";
    title = lesson.subjectShort ?? "";
    roomLine = "entfällt";
    teacherLine = "";
  } else if (lesson.status === "room_change") {
    classes += " sp-cell--changed";
    title = `→ ${lesson.subjectShort ?? ""}`;
  } else if (lesson.status === "substitution") {
    classes += " sp-cell--changed";
    title = `± ${lesson.subjectShort ?? ""}`;
    // Show the swap; fall back to the current teacher if a side is missing.
    teacherLine =
      lesson.previousTeacherShort && lesson.teacherShort
        ? `${lesson.previousTeacherShort} → ${lesson.teacherShort}`
        : lesson.teacherShort ?? "";
  } else if (lesson.status === "changed") {
    // Changed in the plan, but room and teacher are the same (usually just a
    // note): flag it without claiming a change; show the note if any.
    classes += " sp-cell--changed";
    title = lesson.subjectShort ?? "";
    if (lesson.notes?.[0]) roomLine = lesson.notes[0];
  } else {
    title = lesson.subjectShort ?? "";
  }

  const hasHomework = lesson.homework?.length > 0;
  const inner = `
    ${markers(lesson.hasExam, hasHomework)}
    <div class="sp-cell-title">${escapeHtml(title)}</div>
    <div class="sp-cell-meta">${escapeHtml(roomLine)}</div>
    ${teacherLine ? `<div class="sp-cell-meta">${escapeHtml(teacherLine)}</div>` : ""}`;

  // A div, not a <button>: see bindActivate.
  const status = lesson.status === "regular" ? "" : `, ${STATUS_EYEBROW[lesson.status] ?? "Geändert"}`;
  const label = [
    `${day.label} ${lesson.period}. Stunde, ${lesson.subject ?? lesson.subjectShort ?? ""}${status}`,
    lesson.hasExam ? "Test" : "",
    hasHomework ? "Hausaufgabe fällig" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `
    <div class="${classes}" role="button" tabindex="0" data-day-index="${dayIndex}" data-period="${lesson.period}" aria-label="${escapeHtml(label)}">
      ${inner}
    </div>`;
}

/** Headers of days with a test open the test sheet. */
function headerRow(days) {
  const cells = days
    .map((d, i) => {
      const content = `
        <div class="sp-day-label${d.isToday ? " sp-day-label--today" : ""}">${escapeHtml(d.label)}</div>
        <div class="sp-day-date">${escapeHtml(d.dateLabel)}</div>`;
      if (!d.exams.length) return `<div class="sp-day-head">${content}</div>`;
      const label = `${formatWeekday(d.iso, "long")} ${d.dateLabel} – Test anzeigen`;
      return `
        <div class="sp-day-head sp-day-head--exam" role="button" tabindex="0" data-exam-day="${i}" aria-label="${escapeHtml(label)}">
          ${content}
        </div>`;
    })
    .join("");
  return `<div class="sp-grid-row"><span></span>${cells}</div>`;
}

function gridRow(row, days) {
  const cells = row.cells
    .map((lesson, dayIndex) => `<div class="sp-grid-cell">${cellContent(lesson, days[dayIndex], dayIndex)}</div>`)
    .join("");
  return `<div class="sp-grid-row"><div class="sp-period">${row.period}</div>${cells}</div>`;
}

function openLessonDetail(container, day, lesson) {
  const { eyebrow, rows, note } = describeLesson(lesson);
  openDetailSheet(container, {
    eyebrow,
    title: lesson.subject ?? lesson.subjectShort ?? "",
    titleStruck: lesson.status === "cancelled",
    when: { countdown: day.countdown, iso: day.iso },
    rows,
    cards: [{ eyebrow: "Hinweis", text: note }, ...(lesson.homework ?? []).map(homeworkCard)],
  });
}

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

  // Every mount opens on the current week.
  let weekOffset = 0;
  // Last loaded days, for the click delegate to look lessons up in.
  let currentDays = [];
  // Bumped per load, so a slow older response can't overwrite a newer one.
  const loadState = { seq: 0 };

  const prevBtn = container.querySelector("#sp-prev");
  const nextBtn = container.querySelector("#sp-next");

  function goToWeek(offset) {
    const clamped = Math.max(0, Math.min(MAX_WEEK_OFFSET, offset));
    if (clamped === weekOffset) return;
    weekOffset = clamped;
    closeDetailSheet(container);
    loadAndRender(container, studentId, student, weekOffset, loadState).then((days) => {
      if (days) currentDays = days;
    });
  }

  prevBtn.addEventListener("click", () => goToWeek(weekOffset - 1));
  nextBtn.addEventListener("click", () => goToWeek(weekOffset + 1));

  // Swipe left/right changes the week. Bound once: the body node survives
  // re-renders.
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

  // Delegated, so it survives re-renders. A test cell opens the test sheet
  // even when also changed; that sheet shows the new room and any homework.
  function openCellDetail(cellEl) {
    const day = currentDays[Number(cellEl.dataset.dayIndex)];
    const lesson = day?.lessons.find((l) => l.period === Number(cellEl.dataset.period));
    if (!day || !lesson) return;
    const exam = lesson.hasExam && day.exams.find((e) => e.periods.includes(lesson.period));
    if (exam) openExamSheet(container, [exam], cellEl, lesson.homework);
    else openLessonDetail(container, day, lesson);
  }
  bindActivate(body, "[data-period]", openCellDetail);
  bindActivate(body, "[data-exam-day]", (headEl) => {
    const day = currentDays[Number(headEl.dataset.examDay)];
    if (day?.exams.length) openExamSheet(container, day.exams, headEl);
  });

  const days = await loadAndRender(container, studentId, student, weekOffset, loadState);
  if (days) currentDays = days;
}

/** The loaded days, or null if a newer load started meanwhile. */
async function loadAndRender(container, studentId, student, weekOffset, loadState) {
  const seq = ++loadState.seq;
  const body = container.querySelector("#sp-body");
  body.innerHTML = renderSkeleton(6);

  const prevBtn = container.querySelector("#sp-prev");
  const nextBtn = container.querySelector("#sp-next");
  // visibility, not display, so the subtitle doesn't shift.
  prevBtn.disabled = weekOffset === 0;
  prevBtn.classList.toggle("is-invisible", weekOffset === 0);
  nextBtn.disabled = weekOffset === MAX_WEEK_OFFSET;
  nextBtn.classList.toggle("is-invisible", weekOffset === MAX_WEEK_OFFSET);

  try {
    const data = await getStundenplanData(weekOffset, studentId);
    if (loadState.seq !== seq) return null;

    const first = data.days[0];
    const last = data.days[data.days.length - 1];
    const klasse = student?.className ? ` · ${student.className}` : "";
    container.querySelector("#sp-subtitle").textContent =
      `${first.label} ${first.dateLabel} – ${last.label} ${last.dateLabel}${klasse}`;

    const weekLabel = weekLabelFor(data.weeksFromNow);
    const changes =
      data.changeCount > 0
        ? `<span class="sp-change-count">${data.changeCount} Änderung${data.changeCount === 1 ? "" : "en"}</span>`
        : "Keine Änderungen";
    const marks = [
      data.testCount > 0 &&
        `${categoryMarker("exam", "marker--lead")}${data.testCount} Test${data.testCount === 1 ? "" : "s"}`,
      data.homeworkCount > 0 &&
        `${categoryMarker("hw", "marker--lead")}${data.homeworkCount} Hausaufgabe${data.homeworkCount === 1 ? "" : "n"}`,
    ].filter(Boolean);
    const legendParts = marks.length
      ? [changes, ...marks]
      : data.changeCount > 0
        ? [changes, weekLabel]
        : [`${changes} ${weekLabel}`];
    const changesLine = legendParts
      .map((part) => `<span>${part}</span>`)
      .join(`<span aria-hidden="true">·</span>`);

    body.innerHTML = `
      <div class="sp-grid">
        ${headerRow(data.days)}
        ${data.grid.map((row) => gridRow(row, data.days)).join("")}
      </div>
      <div class="sp-legend">${changesLine}</div>
      <div class="sp-legend-hint">Stunde antippen für Details</div>
    `;
    return data.days;
  } catch (err) {
    if (loadState.seq !== seq) return null;
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
    return [];
  }
}
