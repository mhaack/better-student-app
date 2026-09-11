import { fetchGrades, fetchFinalgrades } from "./repository.js";
import { subjectAverage } from "../domain/grades.js";
import { toTrendPoints } from "../domain/trend.js";

/**
 * Collection types are free text configured per school ("Sonstige",
 * "Klausur", "Klassenarbeit", …), so the detail screen groups by whatever
 * types actually occur rather than forcing the design's two fixed buckets.
 */
function groupByType(grades) {
  const byType = new Map();
  for (const grade of grades) {
    const type = grade.collection.type;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(grade);
  }

  const totalWeight = grades.reduce((sum, g) => sum + (g.collection.weighting || 1), 0) || 1;

  return [...byType.entries()]
    .map(([type, list]) => ({
      type,
      grades: list.sort((a, b) => new Date(b.givenAt) - new Date(a.givenAt)),
      weightingPct: Math.round(
        (list.reduce((sum, g) => sum + (g.collection.weighting || 1), 0) / totalWeight) * 100
      ),
      average: mean(list),
    }))
    .sort((a, b) => b.weightingPct - a.weightingPct);
}

function mean(grades) {
  const values = grades.map((g) => g.numeric).filter((n) => n !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function formatNumber(value) {
  return value === null ? "–" : value.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function describeFormula(average, groups, scale) {
  if (average.source === "unavailable") return "Noch keine Noten in diesem Halbjahr.";
  if (average.source === "api_value") return "Von der Schule berechnet und direkt übernommen.";
  if (average.source === "api_formula") return `Formel der Schule: ${average.formula}`;

  const unit = scale === "points_0_15" ? " P" : "";
  const parts = groups.map((g) => `Ø ${g.type} ${formatNumber(g.average)}${unit} (${g.weightingPct} %)`);
  return `${parts.join(" · ")} → ${formatNumber(average.value)}${unit}. Eigene Hochrechnung, keine offizielle Note.`;
}

/**
 * @param {number} studentId
 * @param {number} subjectId
 * @param {{ yearId?: number, intervalId?: number, scale: import('../domain/grades.js').GradeScale }} options
 */
export async function getFachDetailData(studentId, subjectId, options) {
  const { yearId, intervalId, scale } = options;

  // Shares the cache key with the Noten screen, so opening a subject costs
  // no extra request.
  const [allGrades, finalgrades] = await Promise.all([
    fetchGrades(studentId, { yearId, intervalId, scale }),
    fetchFinalgrades(studentId, { yearId }),
  ]);

  const grades = allGrades.filter((g) => g.subjectId === subjectId);
  const finalgrade =
    finalgrades.find(
      (fg) => fg.subject_id === subjectId && (!intervalId || fg.interval_id === intervalId)
    ) ?? null;

  const average = subjectAverage(grades, finalgrade, scale);
  const groups = groupByType(grades);

  const chronological = [...grades]
    .filter((g) => g.numeric !== null)
    .sort((a, b) => new Date(a.givenAt) - new Date(b.givenAt));

  return {
    scale,
    average,
    groups,
    weightingSummary: groups.map((g) => `${g.type} ${g.weightingPct} %`).join(" · "),
    trendPoints:
      chronological.length > 1
        ? toTrendPoints(
            chronological.map((g) => g.numeric),
            { width: 260, height: 60, betterIsHigher: scale === "points_0_15" }
          )
        : null,
    trendValues: chronological.map((g) => g.numeric),
    teacher: finalgrade?.teacher ? [finalgrade.teacher.forename, finalgrade.teacher.name].filter(Boolean).join(" ") : undefined,
    formulaText: describeFormula(average, groups, scale),
  };
}
