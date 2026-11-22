import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getGradeChart, getGradeUnit, setGradeUnit } from "../state/settings.js";
import { chartSelection, getNotenData } from "../data/noten.js";
import { pointsToGradeLabel } from "../domain/grades.js";
import { escapeHtml } from "../util/dom.js";
import { formatAverage, formatMean, formatOverallAverage, scaleUnit } from "../util/format.js";
import { MINI_TREND_WIDTH } from "../domain/trend.js";
import { renderSkeleton, renderErrorState, bindErrorState } from "../components/states.js";
import { barChart, donutChart, distributionTable } from "../components/grade-charts.js";
import { ICONS } from "../components/icons.js";
import { openSubjectFilterSheet, subjectFilterLabel } from "../components/subject-filter-sheet.js";

const VIEWS = [
  { value: "overview", label: "Übersicht" },
  { value: "charts", label: "Diagramme" },
];
const UNITS = [
  { value: "points", label: "0–15 P" },
  { value: "notes", label: "1–6" },
];
const CONVERSION_NOTE = "Umrechnung: 15–13 P = 1 · 12–10 = 2 · 9–7 = 3 · 6–4 = 4 · 3–1 = 5 · 0 = 6";

// Kept for the page session: the view survives a Halbjahr change and later
// visits; the subject filter belongs to one student's Halbjahr.
let view = "overview";
let selectedSubjects = null;
let selectionKey = null;
let showTable = false;

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

function segmented(options, current, { label, attr, modifier = "" }) {
  return `
    <div class="segmented${modifier}" role="group" aria-label="${label}">
      ${options
        .map(
          (o) =>
            `<button type="button" class="segmented-option" ${attr}="${o.value}" aria-pressed="${o.value === current}">${o.label}</button>`
        )
        .join("")}
    </div>`;
}

function setPressed(root, attr, value) {
  for (const button of root.querySelectorAll(`[${attr}]`)) {
    button.setAttribute("aria-pressed", String(button.getAttribute(attr) === value));
  }
}

export async function renderNoten(container) {
  container.innerHTML = `
    <div class="view view--noten">
      <div class="section section--snug">
        <div class="noten-head">
          <h1 class="view-title">Noten</h1>
          <div class="picker-wrap">
            <select id="interval-picker" class="interval-picker interval-picker--caret" aria-label="Halbjahr"></select>
            <span class="picker-caret" aria-hidden="true">${ICONS.chevronDown}</span>
          </div>
        </div>
        ${segmented(VIEWS, view, { label: "Ansicht", attr: "data-view" })}
      </div>
      <div id="noten-body" class="view-body">${renderSkeleton(8)}</div>
    </div>`;

  const page = { data: null, scale: null };

  container.querySelector("[data-view]").parentElement.addEventListener("click", (e) => {
    const button = e.target.closest("[data-view]");
    if (!button || button.dataset.view === view) return;
    view = button.dataset.view;
    setPressed(container, "data-view", view);
    if (page.data) renderBody(container, page);
  });

  try {
    const studentId = getSelectedStudentId();
    const context = await ensureContext();
    page.scale = context.scale;
    // The longer Oberstufe list is a little tighter.
    container.querySelector(".view").classList.toggle("view--points", context.scale === "points_0_15");
    populateIntervalPicker(container, context);

    container.querySelector("#interval-picker").addEventListener("change", async (e) => {
      await loadAndRender(container, page, studentId, context, Number(e.target.value));
    });

    await loadAndRender(container, page, studentId, context, context.interval?.id);
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

async function loadAndRender(container, page, studentId, context, intervalId) {
  const body = container.querySelector("#noten-body");
  body.innerHTML = renderSkeleton(8);
  page.data = null;

  const key = `${studentId}:${intervalId}`;
  if (key !== selectionKey) {
    selectionKey = key;
    selectedSubjects = null;
  }

  page.data = await getNotenData(studentId, {
    yearId: context.year?.id,
    intervalId,
    scale: context.scale,
    courses: context.courses,
  });
  renderBody(container, page);
}

function renderBody(container, page) {
  const body = container.querySelector("#noten-body");
  if (view === "charts") {
    renderChartsPane(container, body, page);
    return;
  }
  body.innerHTML = overviewHtml(page.data, page.scale);
}

function overviewHtml(data, scale) {
  const isPoints = scale === "points_0_15";
  const scaleLabel = isPoints ? "Ø Punkte<br>Skala 0–15" : "Gesamtdurchschnitt<br>Noten 1–6";
  const list =
    isPoints && data.hasCourseTypes
      ? subjectGroup("Leistungskurse", data.lk, scale) + subjectGroup("Grundkurse", data.gk, scale)
      : `<div class="stack">${data.subjects.map((s) => subjectRow(s, scale)).join("")}</div>`;
  const averageUnit = scaleUnit(scale, data.overallAverage.value);
  const noteEquivalent =
    isPoints && data.overallAverage.value !== null
      ? `<div class="grade-equivalent">entspricht etwa ${escapeHtml(pointsToGradeLabel(data.overallAverage.value))}</div>`
      : "";

  return `
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

/** The filter button stays put across re-renders, so the sheet can hand focus back to it. */
function renderChartsPane(container, body, page) {
  body.innerHTML = `
    <div class="noten-charts">
      <button type="button" class="chart-filter" aria-haspopup="dialog"></button>
      <div class="noten-charts-content"></div>
    </div>`;
  const filterButton = body.querySelector(".chart-filter");
  const content = body.querySelector(".noten-charts-content");
  const { subjects } = page.data.chart;

  function update() {
    filterButton.dataset.active = String(selectedSubjects !== null);
    filterButton.innerHTML = `${ICONS.listFilter}<span class="chart-filter-label">${escapeHtml(subjectFilterLabel(selectedSubjects, subjects))}</span><span class="chart-filter-caret" aria-hidden="true">${ICONS.chevronDown}</span>`;
    content.innerHTML = chartsHtml(page.data, page.scale);
  }

  filterButton.addEventListener("click", () => {
    openSubjectFilterSheet(container, {
      subjects,
      selected: selectedSubjects,
      onApply(selected) {
        selectedSubjects = selected;
        update();
      },
    });
  });

  content.addEventListener("click", (e) => {
    const unitButton = e.target.closest("[data-unit]");
    if (unitButton && unitButton.dataset.unit !== getGradeUnit()) {
      setGradeUnit(unitButton.dataset.unit);
      update();
      content.querySelector(`[data-unit="${unitButton.dataset.unit}"]`)?.focus();
      return;
    }
    if (e.target.closest("[data-action='toggle-table']")) {
      showTable = !showTable;
      update();
      content.querySelector("[data-action='toggle-table']")?.focus();
    }
  });

  update();
}

function chartsHtml(data, scale) {
  const isPoints = scale === "points_0_15";
  const isDonut = getGradeChart() === "donut";
  const shownUnit = isPoints ? getGradeUnit() : "notes";
  const { dist, subjectCount } = chartSelection(data.chart, { scale, unit: shownUnit, selected: selectedSubjects });
  const kaLabel = isPoints ? "Klausuren" : "Klassenarbeiten";
  const converted = isPoints && shownUnit === "notes";
  const subjectsText = `${subjectCount} ${subjectCount === 1 ? "Fach" : "Fächer"}`;

  const extras = [
    converted ? "(umgerechnet)" : "",
    selectedSubjects ? `· ${subjectsText}` : "",
  ].filter(Boolean);
  const meanText = `Ø ${formatMean(dist.mean)}${shownUnit === "points" && dist.mean !== null ? " P" : ""}`;
  const stat = `
    <div class="chart-stat">
      <span class="chart-stat-count">${dist.count}</span>
      <span class="chart-stat-text">${dist.count === 1 ? "Note" : "Noten"} · ${meanText}${extras.length ? ` <span class="chart-stat-extra">${extras.join(" ")}</span>` : ""}</span>
    </div>`;

  // Oberstufe titles stay short to leave room for the scale switch.
  let title = "Verteilung nach Note";
  if (isDonut) title = isPoints ? "Anteil" : `Anteil je Note${selectedSubjects ? ` · ${subjectsText}` : ""}`;
  else if (isPoints) title = "Verteilung";
  const unitToggle =
    isPoints ? segmented(UNITS, shownUnit, { label: "Skala", attr: "data-unit", modifier: " segmented--compact" }) : "";

  let chart;
  if (!dist.count) chart = '<div class="chart-empty">Für diese Auswahl gibt es noch keine Noten.</div>';
  else if (showTable) chart = distributionTable(dist, { kaLabel });
  else chart = isDonut ? donutChart(dist, { kaLabel, footnote: !selectedSubjects }) : barChart(dist, { kaLabel });

  return `
    ${stat}
    <div class="card chart-card">
      <div class="chart-card-head">
        <span class="eyebrow">${escapeHtml(title)}</span>
        ${unitToggle}
      </div>
      ${chart}
    </div>
    ${converted && dist.count ? `<div class="chart-note">${CONVERSION_NOTE}</div>` : ""}
    ${dist.count ? `<button type="button" class="chart-table-link" data-action="toggle-table">${showTable ? "Als Diagramm anzeigen ›" : "Als Tabelle anzeigen ›"}</button>` : ""}`;
}
