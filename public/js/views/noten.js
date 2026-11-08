import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getNotenData } from "../data/noten.js";
import { pointsToGradeLabel } from "../domain/grades.js";
import { escapeHtml } from "../util/dom.js";
import { formatAverage, formatOverallAverage, scaleUnit } from "../util/format.js";
import { MINI_TREND_WIDTH } from "../domain/trend.js";
import { renderSkeleton, renderErrorState, bindErrorState } from "../components/states.js";

function trendCell(subject, scale) {
  const width = MINI_TREND_WIDTH[scale];
  if (subject.trendPoints) {
    return `
      <svg class="trend-line" viewBox="0 0 ${width} 30" width="${width}" height="30">
        <line class="chart-grid-line" x1="0" y1="15" x2="${width}" y2="15" />
        <polyline class="chart-line chart-line--soft" points="${subject.trendPoints}" fill="none" stroke-width="1.5" />
      </svg>`;
  }
  return `<span class="trend-empty">kein Verlauf</span>`;
}

function subjectRow(subject, scale) {
  const isEmpty = subject.empty;
  const isPoints = scale === "points_0_15";
  const valueText = isEmpty
    ? "–"
    : `${formatAverage(subject.average.value, scale)}${scaleUnit(scale, subject.average.value)}`;
  const rowClasses = [
    "subject-row",
    "link-reset",
    isPoints ? "subject-row--points" : "",
    isPoints && subject.courseType === "LK" ? "subject-row--lk" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <a class="${rowClasses}" href="#/noten/${subject.subjectId}">
      <div class="subject-cell">
        <div class="subject-name">${escapeHtml(subject.name)}${subject.hasNew ? '<span class="new-dot" role="img" aria-label="neue Noten"></span>' : ""}</div>
        ${subject.average.source === "estimated" ? '<span class="chip">geschätzt</span>' : ""}
        ${subject.average.unterkurs ? '<span class="chip">Unterkurs</span>' : ""}
        ${isEmpty ? '<span class="subject-empty-note">noch keine Noten</span>' : ""}
      </div>
      ${trendCell(subject, scale)}
      <span class="subject-value${isEmpty ? " subject-value--empty" : ""}">${valueText}</span>
    </a>`;
}

function subjectGroup(title, subjects, scale) {
  if (!subjects.length) return "";
  return `
    <div class="grade-group">
      <div class="eyebrow">${escapeHtml(title)}</div>
      <div class="stack">
        ${subjects.map((s) => subjectRow(s, scale)).join("")}
      </div>
    </div>`;
}

export async function renderNoten(container) {
  container.innerHTML = `
    <div class="view view--noten">
      <div class="section section--snug">
        <h1 class="view-title">Noten</h1>
        <div class="picker-wrap">
          <select id="interval-picker" class="interval-picker interval-picker--caret"></select>
          <span class="picker-caret" aria-hidden="true">⌄</span>
        </div>
      </div>
      <div id="noten-body" class="view-body">${renderSkeleton(8)}</div>
    </div>`;

  try {
    const studentId = getSelectedStudentId();
    const context = await ensureContext();
    // The longer Oberstufe list is a little tighter.
    container.querySelector(".view").classList.toggle("view--points", context.scale === "points_0_15");
    populateIntervalPicker(container, context);

    container.querySelector("#interval-picker").addEventListener("change", async (e) => {
      await loadAndRender(container, studentId, context, Number(e.target.value));
    });

    await loadAndRender(container, studentId, context, context.interval?.id);
  } catch (err) {
    container.querySelector("#noten-body").innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}

function populateIntervalPicker(container, context) {
  const picker = container.querySelector("#interval-picker");
  const yearName = context.year?.name ? ` · ${context.year.name}` : "";
  picker.innerHTML = context.intervals
    .map(
      (i) =>
        `<option value="${i.id}" ${i.id === context.interval?.id ? "selected" : ""}>${escapeHtml(i.name)}${escapeHtml(yearName)}</option>`
    )
    .join("");
}

async function loadAndRender(container, studentId, context, intervalId) {
  const { scale } = context;
  const body = container.querySelector("#noten-body");
  body.innerHTML = renderSkeleton(8);

  const data = await getNotenData(studentId, {
    yearId: context.year?.id,
    intervalId,
    scale,
    courses: context.courses,
  });

  const isPoints = scale === "points_0_15";
  const scaleLabel = isPoints ? "Ø Punkte<br>Skala 0–15" : "Gesamtdurchschnitt<br>Noten 1–6";
  const list = isPoints && data.hasCourseTypes
    ? subjectGroup("Leistungskurse", data.lk, scale) + subjectGroup("Grundkurse", data.gk, scale)
    : `<div class="stack">${data.subjects.map((s) => subjectRow(s, scale)).join("")}</div>`;
  const averageUnit = scaleUnit(scale, data.overallAverage.value);
  const noteEquivalent =
    isPoints && data.overallAverage.value !== null
      ? `<div class="grade-equivalent">entspricht etwa ${escapeHtml(pointsToGradeLabel(data.overallAverage.value))}</div>`
      : "";

  body.innerHTML = `
    <div class="average-header${isPoints ? " average-header--points" : ""}">
      <div>
        <div class="average-row">
          <div class="average-value">${formatOverallAverage(data.overallAverage.value, scale)}${averageUnit ? `<span class="average-unit">${averageUnit}</span>` : ""}</div>
          <div class="average-label">${scaleLabel}</div>
        </div>
        ${noteEquivalent}
      </div>
    </div>
    ${list}
    <div class="noten-footnote">
      Verlauf: links früh, rechts aktuell — oben ist immer besser.
      <strong>geschätzt</strong> = eigene Hochrechnung, keine offizielle Note.
    </div>
  `;
}
