import { fetchYears, fetchIntervals, fetchSubjects } from "./repository.js";

function isCurrentByDateRange(item, today) {
  if (!item.from || !item.to) return false;
  return new Date(item.from) <= today && today <= new Date(item.to);
}

function pickCurrentOrLast(items, today) {
  return items.find((item) => isCurrentByDateRange(item, today)) ?? items[items.length - 1] ?? null;
}

/**
 * Resolves the scale (Sek I vs. Oberstufe) and the current year/interval for
 * a student, so views don't each re-implement "which Halbjahr is this".
 * Heuristic for scale: any subject carrying an LK/GK courseType means
 * Oberstufe. Verify against docs/api-notes.md once discovery has run —
 * there may be a more direct signal (Jahrgang/level on the student or group).
 */
export async function getSchoolContext(studentId) {
  const [subjects, years] = await Promise.all([fetchSubjects(studentId), fetchYears()]);
  const scale = subjects.some((s) => s.courseType === "LK" || s.courseType === "GK") ? "points_0_15" : "grade_1_6";

  const today = new Date();
  const year = pickCurrentOrLast(years, today);
  const intervals = year ? await fetchIntervals(year.id) : [];
  const interval = pickCurrentOrLast(intervals, today);

  return { scale, year, intervals, interval };
}
