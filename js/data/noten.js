import { fetchSubjects, fetchGrades, fetchFinalgrades, fetchFinalgradeDetail } from "./repository.js";
import { subjectAverage, isUnterkurs } from "../domain/grades.js";
import { toTrendPoints } from "../domain/trend.js";

const TREND_POINTS_COUNT = 4;

/**
 * Aggregates the "Noten" screen for one student/interval on one scale.
 * @param {number} studentId
 * @param {{ yearId?: number, intervalId?: number, scale: import('../domain/grades.js').GradeScale }} options
 */
export async function getNotenData(studentId, options) {
  const { yearId, intervalId, scale } = options;

  const [subjects, grades, finalgradeSummaries] = await Promise.all([
    fetchSubjects(studentId),
    fetchGrades(studentId, { yearId, intervalId, scale }),
    fetchFinalgrades(studentId, { yearId }),
  ]);

  const finalgradeBySubject = new Map();
  for (const fg of finalgradeSummaries) {
    if (!intervalId || fg.interval_id === intervalId || fg.intervalId === intervalId) {
      finalgradeBySubject.set(fg.subject_id ?? fg.subjectId, fg);
    }
  }

  const details = await Promise.all(
    [...finalgradeBySubject.values()].map((fg) => fetchFinalgradeDetail(fg.id).then((detail) => [fg.subject_id ?? fg.subjectId, detail]))
  );
  const detailBySubject = new Map(details);

  const subjectResults = subjects.map((subject) => {
    const subjectGrades = grades.filter((g) => g.subjectId === subject.id);
    const detail = detailBySubject.get(subject.id) ?? null;
    const average = subjectAverage(subjectGrades, detail, scale);

    const chronological = [...subjectGrades]
      .filter((g) => g.numeric !== null)
      .sort((a, b) => new Date(a.givenAt) - new Date(b.givenAt))
      .slice(-TREND_POINTS_COUNT);

    const trendPoints =
      chronological.length > 1
        ? toTrendPoints(
            chronological.map((g) => g.numeric),
            { width: 84, height: 30, betterIsHigher: scale === "points_0_15" }
          )
        : null;

    return {
      subjectId: subject.id,
      name: subject.name,
      courseType: subject.courseType,
      average,
      trendPoints,
      empty: average.value === null,
    };
  });

  const withValue = subjectResults.filter((s) => s.average.value !== null);
  const overallValue = withValue.length
    ? withValue.reduce((sum, s) => sum + s.average.value, 0) / withValue.length
    : null;

  const result = {
    scale,
    overallAverage: { value: overallValue, scale },
    subjects: subjectResults,
  };

  if (scale === "points_0_15") {
    result.unterkursCount = subjectResults.filter((s) => s.average.unterkurs).length;
    result.lk = subjectResults.filter((s) => s.courseType === "LK");
    result.gk = subjectResults.filter((s) => s.courseType !== "LK");
  }

  return result;
}
