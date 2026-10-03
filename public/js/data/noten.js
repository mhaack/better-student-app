import { fetchGrades, fetchFinalgrades } from "./repository.js";
import { subjectAverage } from "../domain/grades.js";
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

  const [grades, finalgrades] = await Promise.all([
    fetchGrades(studentId, { yearId, intervalId, scale }),
    fetchFinalgrades(studentId, { yearId }),
  ]);

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
    };
  });

  const withValue = subjects.filter((s) => s.average.value !== null);
  const overallValue = withValue.length
    ? withValue.reduce((sum, s) => sum + s.average.value, 0) / withValue.length
    : null;

  const result = {
    scale,
    overallAverage: { value: overallValue, scale },
    subjects,
  };

  if (scale === "points_0_15") {
    result.lk = subjects.filter((s) => s.courseType === "LK");
    result.gk = subjects.filter((s) => s.courseType !== "LK");
    // Without a trustworthy LK/GK split: one flat list.
    result.hasCourseTypes = result.lk.length > 0;
  }

  return result;
}
