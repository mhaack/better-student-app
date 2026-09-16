import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getNotenData } from "../data/noten.js";
import { escapeHtml } from "../util/dom.js";
import { formatAverage, formatOverallAverage } from "../util/format.js";
import { MINI_TREND_WIDTH } from "../domain/trend.js";
import { renderSkeleton, renderErrorState, bindErrorState } from "../components/states.js";

function trendCell(subject, scale) {
  const width = MINI_TREND_WIDTH[scale];
  if (subject.trendPoints) {
    return `
      <svg class="trend-line" viewBox="0 0 ${width} 30" width="${width}" height="30">
        <line x1="0" y1="15" x2="${width}" y2="15" style="stroke:var(--chart-grid)" />
        <polyline points="${subject.trendPoints}" fill="none" style="stroke:var(--text-secondary)" stroke-width="1.5" />
      </svg>`;
  }
  return `<span class="trend-empty">kein Verlauf</span>`;
}

function subjectRow(subject, scale) {
  const isEmpty = subject.empty;
  const isPoints = scale === "points_0_15";
  const valueText = isEmpty
    ? "–"
    : `${formatAverage(subject.average.value, scale)}${isPoints ? " P" : ""}`;
  const rowClasses = [
    "subject-row",
    isPoints ? "subject-row--points" : "",
    isPoints && subject.courseType === "LK" ? "subject-row--lk" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <a class="${rowClasses}" href="#/noten/${subject.subjectId}" style="text-decoration:none;color:inherit">
      <div style="display:flex;flex-direction:column;gap:4px">
        <div class="subject-name">${escapeHtml(subject.name)}</div>
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
      <div style="display:flex;flex-direction:column">
        ${subjects.map((s) => subjectRow(s, scale)).join("")}
      </div>
    </div>`;
}

export async function renderNoten(container) {
  container.innerHTML = `
    <div class="view">
      <div class="section" style="gap:12px">
        <h1 class="view-title">Noten</h1>
        <div style="position:relative;align-self:flex-start">
          <select id="interval-picker" class="interval-picker" style="padding-right:32px"></select>
          <span aria-hidden="true" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text-primary);font-size:12px">⌄</span>
        </div>
      </div>
      <div id="noten-body" class="view-body">${renderSkeleton(8)}</div>
    </div>`;

  try {
    const studentId = getSelectedStudentId();
    const context = await ensureContext();
    // The Oberstufe list carries more rows, so the design tightens the
    // vertical rhythm a little (2a: 20px vs 24px).
    container.querySelector(".view").style.gap =
      context.scale === "points_0_15" ? "20px" : "24px";
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
    : `<div style="display:flex;flex-direction:column">${data.subjects.map((s) => subjectRow(s, scale)).join("")}</div>`;

  body.innerHTML = `
    <div class="average-header${isPoints ? " average-header--points" : ""}">
      <div style="display:flex;align-items:baseline;gap:14px">
        <div class="average-value">${formatOverallAverage(data.overallAverage.value, scale)}${isPoints ? '<span style="font-size:30px"> P</span>' : ""}</div>
        <div class="average-label">${scaleLabel}</div>
      </div>
    </div>
    ${list}
    <div style="font-size:12px;line-height:1.5;color:var(--text-muted)">
      Verlauf: links früh, rechts aktuell — oben ist immer besser.
      <strong style="color:var(--text-secondary);font-weight:600">geschätzt</strong> = eigene Hochrechnung, keine offizielle Note.
    </div>
  `;
}
