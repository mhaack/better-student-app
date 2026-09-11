import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getFachDetailData } from "../data/fach-detail.js";
import { pointsToGradeLabel } from "../domain/grades.js";
import { escapeHtml } from "../util/dom.js";
import { formatAverage, weekdayOrDate } from "../util/format.js";
import { renderSkeleton, renderErrorState } from "../components/states.js";

function gradeEntryRow(grade, isPoints) {
  const title = grade.collection.name || grade.collection.type;
  return `
    <div class="grade-entry-row${isPoints ? " grade-entry-row--points" : ""}">
      <div>
        <div style="font-size:16px;color:var(--text-primary)">${escapeHtml(title)}</div>
        ${grade.givenAt ? `<div style="font-size:12px;color:var(--text-muted)">${escapeHtml(weekdayOrDate(grade.givenAt))}</div>` : ""}
      </div>
      <span class="grade-capsule">${escapeHtml(grade.raw)}</span>
    </div>`;
}

function gradeGroup(group, isPoints) {
  return `
    <div class="grade-group">
      <div class="grade-group-header">
        <span class="eyebrow">${escapeHtml(group.type)}</span>
        <span style="font-size:12px;color:var(--text-secondary)">${group.weightingPct} %</span>
      </div>
      ${group.grades.map((g) => gradeEntryRow(g, isPoints)).join("")}
    </div>`;
}

/** Each grade gets a marker, with the most recent one filled in. */
function trendMarkers(trendPoints) {
  const points = trendPoints.split(" ").filter(Boolean);
  return points
    .map((pair, index) => {
      const [x, y] = pair.split(",");
      const isLatest = index === points.length - 1;
      return isLatest
        ? `<circle cx="${x}" cy="${y}" r="3.5" style="fill:var(--text-primary)" />`
        : `<circle cx="${x}" cy="${y}" r="3.5" style="fill:var(--surface);stroke:var(--text-primary)" stroke-width="2" />`;
    })
    .join("");
}

function trendChart(trendPoints, scale) {
  if (!trendPoints) return "";
  const [top, bottom] = scale === "points_0_15" ? ["15", "0"] : ["1", "6"];
  const betterLabel = scale === "points_0_15" ? "oben = besser (15 P)" : "oben = besser (1)";
  return `
    <div class="card card--chart" style="display:flex;flex-direction:column;gap:10px">
      <div class="card-row">
        <span class="eyebrow">Verlauf</span>
        <span style="font-size:11px;color:var(--text-muted)">${betterLabel}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:stretch">
        <div style="display:flex;flex-direction:column;justify-content:space-between;font-size:11px;color:var(--text-muted);padding:2px 0">
          <span>${top}</span><span>${bottom}</span>
        </div>
        <svg viewBox="0 0 260 60" width="100%" height="60" preserveAspectRatio="none" style="overflow:visible">
          <line x1="0" y1="1" x2="260" y2="1" style="stroke:var(--chart-grid)" />
          <line x1="0" y1="30" x2="260" y2="30" style="stroke:var(--chart-grid)" />
          <line x1="0" y1="59" x2="260" y2="59" style="stroke:var(--chart-grid)" />
          <polyline points="${trendPoints}" fill="none" style="stroke:var(--text-primary)" stroke-width="2" stroke-linejoin="round" />
          ${trendMarkers(trendPoints)}
        </svg>
      </div>
    </div>`;
}

export async function renderFachDetail(container, { subjectId }) {
  container.innerHTML = `
    <div class="view view--detail">
      <a class="back-link" href="#/noten">‹ Noten</a>
      <div id="fach-body" class="view-body">${renderSkeleton(8)}</div>
    </div>`;

  try {
    const studentId = getSelectedStudentId();
    const context = await ensureContext();
    const subjectIdNum = Number(subjectId);
    const course = context.courses.find((c) => c.subjectId === subjectIdNum);
    const { scale } = context;

    const data = await getFachDetailData(studentId, subjectIdNum, {
      yearId: context.year?.id,
      intervalId: context.interval?.id,
      scale,
    });

    const isPoints = scale === "points_0_15";
    container.querySelector(".view").style.gap = isPoints ? "15px" : "18px";

    const noteEquivalent =
      isPoints && data.average.value !== null
        ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">entspricht etwa ${escapeHtml(pointsToGradeLabel(data.average.value))}</div>`
        : "";

    container.querySelector("#fach-body").innerHTML = `
      <div class="subject-header${isPoints && course?.courseType ? " subject-header--badged" : ""}">
        <div>
          ${
            isPoints && course?.courseType
              ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                   <span class="badge-lk">${escapeHtml(course.courseType)}</span>
                   <span style="font-size:12px;color:var(--text-muted)">${escapeHtml(context.interval?.name ?? "")}</span>
                 </div>`
              : ""
          }
          <div class="subject-header-title">${escapeHtml(course?.name ?? "")}</div>
          <div class="subject-header-weighting">${escapeHtml(data.weightingSummary || "Noch keine Gewichtung")}</div>
        </div>
        <div style="text-align:right">
          <div class="subject-header-value">${formatAverage(data.average.value, scale)}${isPoints && data.average.value !== null ? '<span style="font-size:26px"> P</span>' : ""}</div>
          ${noteEquivalent}
        </div>
      </div>

      ${trendChart(data.trendPoints, scale)}

      ${
        data.groups.length
          ? data.groups.map((g) => gradeGroup(g, isPoints)).join("")
          : '<div class="empty-state">In diesem Halbjahr gibt es noch keine Noten in diesem Fach.</div>'
      }

      <div>
        <button id="formula-toggle" class="formula-toggle" aria-expanded="false">
          <span>So wird gerechnet</span>
          <span id="formula-chevron">⌄</span>
        </button>
        <div id="formula-text" class="formula-text" hidden>${escapeHtml(data.formulaText)}</div>
      </div>
    `;

    const toggle = container.querySelector("#formula-toggle");
    const text = container.querySelector("#formula-text");
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      text.hidden = expanded;
      container.querySelector("#formula-chevron").textContent = expanded ? "⌄" : "⌃";
    });
  } catch (err) {
    container.querySelector("#fach-body").innerHTML = renderErrorState(escapeHtml(err.message));
  }
}
