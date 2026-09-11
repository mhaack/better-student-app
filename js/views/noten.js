import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getNotenData } from "../data/noten.js";
import { escapeHtml } from "../util/dom.js";
import { formatAverage, formatOverallAverage } from "../util/format.js";
import { renderSkeleton, renderErrorState } from "../components/states.js";

function trendCell(subject) {
  if (subject.trendPoints) {
    return `
      <svg class="trend-line" viewBox="0 0 84 30" width="84" height="30">
        <line x1="0" y1="15" x2="84" y2="15" style="stroke:var(--border)" />
        <polyline points="${subject.trendPoints}" fill="none" style="stroke:var(--text-secondary)" stroke-width="1.5" />
      </svg>`;
  }
  return `<span class="trend-empty">kein Verlauf</span>`;
}

function subjectRow(subject, scale) {
  const isEmpty = subject.empty;
  const valueText = isEmpty ? "–" : `${formatAverage(subject.average.value, scale)}${scale === "points_0_15" ? " P" : ""}`;
  return `
    <a class="subject-row" href="#/noten/${subject.subjectId}" style="text-decoration:none;color:inherit">
      <div style="display:flex;flex-direction:column;gap:4px">
        <div class="subject-name">${escapeHtml(subject.name)}</div>
        ${subject.average.source === "estimated" ? '<span class="chip">geschätzt</span>' : ""}
        ${subject.average.unterkurs ? '<span class="chip">Unterkurs</span>' : ""}
        ${isEmpty ? '<span class="subject-empty-note">noch keine Noten</span>' : ""}
      </div>
      ${trendCell(subject)}
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
        <select id="interval-picker" class="interval-picker" style="border:1px solid var(--border);appearance:none"></select>
      </div>
      <div id="noten-body">${renderSkeleton(8)}</div>
    </div>`;

  try {
    const studentId = getSelectedStudentId();
    const context = await ensureContext();
    populateIntervalPicker(container, context);

    container.querySelector("#interval-picker").addEventListener("change", async (e) => {
      await loadAndRender(container, studentId, context.scale, Number(e.target.value));
    });

    await loadAndRender(container, studentId, context.scale, context.interval?.id);
  } catch (err) {
    container.querySelector("#noten-body").innerHTML = renderErrorState(escapeHtml(err.message));
  }
}

function populateIntervalPicker(container, context) {
  const picker = container.querySelector("#interval-picker");
  picker.innerHTML = context.intervals
    .map((i) => `<option value="${i.id}" ${i.id === context.interval?.id ? "selected" : ""}>${escapeHtml(i.name)}</option>`)
    .join("");
}

async function loadAndRender(container, studentId, scale, intervalId) {
  const body = container.querySelector("#noten-body");
  body.innerHTML = renderSkeleton(8);

  const data = await getNotenData(studentId, { intervalId, scale });
  const scaleLabel = scale === "points_0_15" ? "Ø Punkte<br>Skala 0–15" : "Gesamtdurchschnitt<br>Noten 1–6";

  body.innerHTML = `
    <div class="average-header" style="justify-content:${scale === "points_0_15" ? "space-between" : "flex-start"}">
      <div style="display:flex;align-items:baseline;gap:14px">
        <div class="average-value">${formatOverallAverage(data.overallAverage.value, scale)}${scale === "points_0_15" ? '<span style="font-size:30px"> P</span>' : ""}</div>
        <div class="average-label">${scaleLabel}</div>
      </div>
      ${scale === "points_0_15" ? `<span class="unterkurs-counter">${data.unterkursCount} Unterkurs${data.unterkursCount === 1 ? "" : "e"}</span>` : ""}
    </div>
    ${
      scale === "points_0_15"
        ? subjectGroup("Leistungskurse", data.lk, scale) + subjectGroup("Grundkurse", data.gk, scale)
        : `<div style="display:flex;flex-direction:column">${data.subjects.map((s) => subjectRow(s, scale)).join("")}</div>`
    }
    <div style="font-size:12px;line-height:1.5;color:var(--text-muted)">
      Verlauf: links früh, rechts aktuell — oben ist immer besser.
      <strong style="color:var(--text-secondary);font-weight:600">geschätzt</strong> = eigene Hochrechnung, keine offizielle Note.
    </div>
  `;
}
