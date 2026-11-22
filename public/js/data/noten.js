import { fetchGrades, fetchFinalgrades, fetchRole } from "./repository.js";
import { markNewGrades, overallAverage, subjectAverage } from "../domain/grades.js";
import { gradeDistribution, gradeKind, wholeNote } from "../domain/grade-distribution.js";
import { toTrendPoints, MINI_TREND_WIDTH } from "../domain/trend.js";

const TREND_POINTS_COUNT = 4;

/**
 * The "Noten" screen for one Halbjahr. `courses` are the student's own groups
 * from the context (/api/subjects lists every subject of the school).
 *
 * @param {number} studentId
 * @param {{ yearId?: number, intervalId?: number, scale: import('../domain/grades.js').GradeScale, courses: Array<object> }} options
 */
export async function getNotenData(studentId, options) {
  const { yearId, intervalId, scale, courses } = options;

  const [allGrades, finalgrades, role] = await Promise.all([
    fetchGrades(studentId, { yearId, intervalId, scale }),
    fetchFinalgrades(studentId, { yearId }),
    fetchRole(),
  ]);
  const grades = markNewGrades(allGrades, role);

  const finalgradeBySubject = new Map();
  for (const fg of finalgrades) {
    if (!intervalId || fg.interval_id === intervalId) finalgradeBySubject.set(fg.subject_id, fg);
  }

  const subjects = courses.map((course) => {
    const subjectGrades = grades.filter((g) => g.subjectId === course.subjectId);
    const average = subjectAverage(subjectGrades, finalgradeBySubject.get(course.subjectId) ?? null, scale);

    const chronological = [...subjectGrades]
      .filter((g) => g.numeric !== null)
      .sort((a, b) => new Date(a.givenAt) - new Date(b.givenAt))
      .slice(-TREND_POINTS_COUNT);

    return {
      subjectId: course.subjectId,
      name: course.name,
      courseType: course.courseType,
      average,
      trendPoints:
        chronological.length > 1
          ? toTrendPoints(
              chronological.map((g) => g.numeric),
              // No axis: direction only, scaled to this subject's range.
              { width: MINI_TREND_WIDTH[scale], height: 30, betterIsHigher: scale === "points_0_15", insetX: 2 }
            )
          : null,
      empty: average.value === null,
      hasNew: subjectGrades.some((g) => g.isNew),
    };
  });

  const result = {
    scale,
    overallAverage: { value: overallAverage(subjects, scale), scale },
    subjects,
    chart: chartData(grades, courses, scale),
  };

  if (scale === "points_0_15") {
    result.lk = subjects.filter((s) => s.courseType === "LK");
    result.gk = subjects.filter((s) => s.courseType !== "LK");
    // Without a trustworthy LK/GK split: one flat list.
    result.hasCourseTypes = result.lk.length > 0;
  }

  return result;
}

/**
 * Every single grade with a value, for the Diagramme; subject averages never
 * enter it (they may be estimates).
 */
function chartData(grades, courses, scale) {
  const toValue = scale === "points_0_15" ? Math.round : wholeNote;
  const entries = [];
  const subjects = courses.map((course) => {
    const counted = grades.filter((g) => g.subjectId === course.subjectId && g.numeric !== null);
    for (const g of counted) {
      entries.push({ subjectId: course.subjectId, value: toValue(g.numeric), kind: gradeKind(g.collection.type) });
    }
    return { subjectId: course.subjectId, name: course.name, courseType: course.courseType, count: counted.length };
  });
  // The Fächer sheet: Oberstufe Leistungskurse first, then alphabetical.
  const lkFirst = (s) => (scale === "points_0_15" && s.courseType === "LK" ? 0 : 1);
  subjects.sort((a, b) => lkFirst(a) - lkFirst(b) || a.name.localeCompare(b.name, "de"));
  return { entries, subjects };
}

/**
 * The Diagramme for the chosen subjects: their distribution and how many of
 * them have grades (the "· n Fächer" in the donut's title).
 * @param {{ chart: { entries: Array<{ subjectId: number, value: number, kind: "ka" | "sl" }> } }} data from getNotenData
 * @param {{ scale: import('../domain/grades.js').GradeScale, unit: "notes" | "points", selected: Set<number> | null }} options
 */
export function chartSelection(data, { scale, unit, selected }) {
  const chosen = (subjectId) => !selected || selected.has(subjectId);
  const entries = data.chart.entries.filter((e) => chosen(e.subjectId));
  return {
    dist: gradeDistribution(entries, { scale, unit }),
    subjectCount: new Set(entries.map((e) => e.subjectId)).size,
  };
}

/** Whether the Noten tab gets its dot: a grade in the current Halbjahr the viewer's side hasn't seen. */
export async function hasNewGrades(studentId, context) {
  const { year, interval, scale, courses } = context;
  const [grades, role] = await Promise.all([
    // Same cache key as the Noten screen's default Halbjahr.
    fetchGrades(studentId, { yearId: year?.id, intervalId: interval?.id, scale }),
    fetchRole(),
  ]);
  const courseSubjects = new Set(courses.map((c) => c.subjectId));
  return markNewGrades(grades, role).some((g) => g.isNew && courseSubjects.has(g.subjectId));
}
