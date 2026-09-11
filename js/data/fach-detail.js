import { apiFetchAll } from "../api/client.js";
import { fetchFinalgrades, fetchFinalgradeDetail } from "./repository.js";
import { mapGrade } from "../api/mappers.js";
import { subjectAverage } from "../domain/grades.js";
import { toTrendPoints } from "../domain/trend.js";

// Which collection.type values count as the "big" graded work (Klassenarbeit /
// Klausur) vs. "Sonstige Leistungen" — matches the grouping in the design
// (project/Schulblick Layoutrichtungen.dc.html, 2a C1/C2). Verify the real
// type codes in docs/api-notes.md once Phase 0 discovery has run.
const PRIMARY_TYPES = new Set(["ka", "klausur"]);

function isPrimaryType(type) {
  return PRIMARY_TYPES.has(String(type ?? "").toLowerCase());
}

function weightingPercent(grades) {
  const total = grades.reduce((sum, g) => sum + (g.collection.weighting || 1), 0) || 1;
  const primary = grades.filter((g) => isPrimaryType(g.collection.type)).reduce((sum, g) => sum + (g.collection.weighting || 1), 0);
  const pct = Math.round((primary / total) * 100);
  return { primaryPct: pct, secondaryPct: 100 - pct };
}

function describeFormula(average, primaryGrades, secondaryGrades, weighting) {
  if (average.source === "api_value") return "Wert von der Schule berechnet und direkt übernommen.";
  if (average.source === "api_formula") return `Formel der Schule: ${average.formula}`;
  if (average.source === "unavailable") return "Noch keine Noten vorhanden.";

  const avg = (list) => {
    const nums = list.map((g) => g.numeric).filter((n) => n !== null);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };
  const primaryAvg = avg(primaryGrades);
  const secondaryAvg = avg(secondaryGrades);
  const fmt = (n) => (n === null ? "–" : n.toLocaleString("de-DE", { maximumFractionDigits: 2 }));

  return `Ø Arbeiten ${fmt(primaryAvg)} · Ø Sonstige ${fmt(secondaryAvg)}, ${weighting.primaryPct} % / ${weighting.secondaryPct} % → ${fmt(average.value)} (geschätzt).`;
}

/**
 * @param {number} studentId
 * @param {number} subjectId
 * @param {{ yearId?: number, intervalId?: number, scale: import('../domain/grades.js').GradeScale }} options
 */
export async function getFachDetailData(studentId, subjectId, options) {
  const { yearId, intervalId, scale } = options;

  const [rawGrades, finalgradeSummaries] = await Promise.all([
    apiFetchAll("grades", {
      params: {
        "filter[student]": studentId,
        "filter[subject]": subjectId,
        ...(yearId ? { "filter[year]": yearId } : {}),
        ...(intervalId ? { "filter[interval]": intervalId } : {}),
        include: "collection,subject,teacher",
      },
    }),
    fetchFinalgrades(studentId, { yearId }),
  ]);

  const grades = rawGrades.map((raw) => mapGrade(raw, scale));
  const finalgrade = finalgradeSummaries.find(
    (fg) =>
      (fg.subject_id ?? fg.subjectId) === subjectId &&
      (!intervalId || fg.interval_id === intervalId || fg.intervalId === intervalId)
  );
  const detail = finalgrade ? await fetchFinalgradeDetail(finalgrade.id) : null;

  const average = subjectAverage(grades, detail, scale);

  const primaryGrades = grades.filter((g) => isPrimaryType(g.collection.type));
  const secondaryGrades = grades.filter((g) => !isPrimaryType(g.collection.type));
  const weighting = weightingPercent(grades);

  const chronological = [...grades]
    .filter((g) => g.numeric !== null)
    .sort((a, b) => new Date(a.givenAt) - new Date(b.givenAt));

  const trendPoints =
    chronological.length > 1
      ? toTrendPoints(
          chronological.map((g) => g.numeric),
          { width: 260, height: 60, betterIsHigher: scale === "points_0_15" }
        )
      : null;

  return {
    scale,
    average,
    primaryGroupLabel: scale === "points_0_15" ? "Klausur" : "Klassenarbeiten",
    primaryGrades,
    secondaryGrades,
    weighting,
    trendPoints,
    trendValues: chronological.map((g) => g.numeric),
    formulaText: describeFormula(average, primaryGrades, secondaryGrades, weighting),
  };
}
