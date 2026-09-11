import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getFachDetailData } from "../data/fach-detail.js";
import { fetchSubjects } from "../data/repository.js";
import { pointsToGradeLabel } from "../domain/grades.js";
import { escapeHtml } from "../util/dom.js";
import { formatAverage, weekdayOrDate } from "../util/format.js";
import { renderSkeleton, renderErrorState } from "../components/states.js";

function gradeEntryRow(grade, showDate) {
  return `
    <div class="grade-entry-row">
      <div>
        <div style="font-size:16px;color:var(--text-primary)">${escapeHtml(grade.collection.name || grade.collection.type)}</div>
        ${showDate ? `<div style="font-size:12px;color:var(--text-muted)">${escapeHtml(weekdayOrDate(grade.givenAt))}</div>` : ""}
      </div>
      <span class="grade-capsule">${escapeHtml(grade.raw)}</span>
    </div>`;
}

function trendChart(values, trendPoints, scale) {
  if (!trendPoints) return "";
  const [top, bottom] = scale === "points_0_15" ? ["15", "0"] : ["1", "6"];
  const betterLabel = scale === "points_0_15" ? "oben = besser (15 P)" : "oben = besser (1)";
  return `
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="card-row">
        <span class="eyebrow">Verlauf</span>
        <span style="font-size:11px;color:var(--text-muted)">${betterLabel}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:stretch">
        <div style="display:flex;flex-direction:column;justify-content:space-between;font-size:11px;color:var(--text-muted);padding:2px 0">
          <span>${top}</span><span>${bottom}</span>
        </div>
        <svg viewBox="0 0 260 60" width="100%" height="60" preserveAspectRatio="none" style="overflow:visible">
          <line x1="0" y1="1" x2="260" y2="1" style="stroke:var(--border)" />
          <line x1="0" y1="30" x2="260" y2="30" style="stroke:var(--border)" />
          <line x1="0" y1="59" x2="260" y2="59" style="stroke:var(--border)" />
          <polyline points="${trendPoints}" fill="none" style="stroke:var(--text-primary)" stroke-width="2" stroke-linejoin="round" />
        </svg>
      </div>
    </div>`;
}

export async function renderFachDetail(container, { subjectId }) {
  container.innerHTML = `
    <div class="view" style="gap:18px">
      <a class="back-link" href="#/noten">‹ Noten</a>
      <div id="fach-body">${renderSkeleton(8)}</div>
    </div>`;

  try {
    const studentId = getSelectedStudentId();
    const context = await ensureContext();
    const subjectIdNum = Number(subjectId);

    const [subjects, data] = await Promise.all([
      fetchSubjects(studentId),
      getFachDetailData(studentId, subjectIdNum, { intervalId: context.interval?.id, scale: context.scale }),
    ]);
    const subject = subjects.find((s) => s.id === subjectIdNum);
    const scale = context.scale;

    const noteEquivalent =
      scale === "points_0_15" && data.average.value !== null
        ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">entspricht etwa ${escapeHtml(pointsToGradeLabel(data.average.value))}</div>`
        : "";

    container.querySelector("#fach-body").innerHTML = `
      <div class="subject-header">
        <div>
          ${
            subject?.courseType
              ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                   <span class="badge-lk">${escapeHtml(subject.courseType)}</span>
                   <span style="font-size:12px;color:var(--text-muted)">${escapeHtml(context.interval?.name ?? "")}</span>
                 </div>`
              : ""
          }
          <div class="subject-header-title">${escapeHtml(subject?.name ?? "")}</div>
          <div class="subject-header-weighting">${escapeHtml(data.primaryGroupLabel)} ${data.weighting.primaryPct} % · Sonstige ${data.weighting.secondaryPct} %</div>
        </div>
        <div style="text-align:right">
          <div class="subject-header-value">${formatAverage(data.average.value, scale)}${scale === "points_0_15" ? '<span style="font-size:26px"> P</span>' : ""}</div>
          ${noteEquivalent}
        </div>
      </div>

      ${trendChart(data.trendValues, data.trendPoints, scale)}

      <div class="grade-group">
        <div class="grade-group-header">
          <span class="eyebrow">${escapeHtml(data.primaryGroupLabel)}</span>
          <span style="font-size:12px;color:var(--text-secondary)">${data.weighting.primaryPct} %</span>
        </div>
        ${data.primaryGrades.length ? data.primaryGrades.map((g) => gradeEntryRow(g, true)).join("") : '<div class="subject-empty-note">noch keine Noten</div>'}
      </div>

      <div class="grade-group">
        <div class="grade-group-header">
          <span class="eyebrow">Sonstige Leistungen</span>
          <span style="font-size:12px;color:var(--text-secondary)">${data.weighting.secondaryPct} %</span>
        </div>
        ${data.secondaryGrades.length ? data.secondaryGrades.map((g) => gradeEntryRow(g, false)).join("") : '<div class="subject-empty-note">noch keine Noten</div>'}
      </div>

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
