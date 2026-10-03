import { fetchYears, fetchGroups, fetchFinalgrades } from "./repository.js";
import { scaleForIntervalType, looksLikeLeistungskurs } from "../api/mappers.js";

function isCurrentByDateRange(item, today) {
  if (!item.from || !item.to) return false;
  return new Date(item.from) <= today && today <= new Date(item.to);
}

function pickCurrentOrLast(items, today) {
  return items.find((item) => isCurrentByDateRange(item, today)) ?? items[items.length - 1] ?? null;
}

/** "11BIO1" / "11-12la1" -> 11. Used only as a fallback Jahrgang signal. */
function jahrgangFromGroup(group) {
  const match = String(group.localId ?? "").match(/^(\d{1,2})/);
  return match ? Number(match[1]) : null;
}

function intervalTypeFromJahrgang(jahrgang) {
  if (jahrgang === 11) return "11er";
  if (jahrgang === 12) return "12er";
  return "Sek I";
}

/**
 * LK/GK from group names. If that flags none or implausibly many LKs,
 * everything is a Grundkurs and Noten shows one flat list.
 */
function resolveCourseTypes(courses) {
  const flagged = courses.filter(looksLikeLeistungskurs);
  const trustworthy = flagged.length >= 1 && flagged.length <= 3 && flagged.length < courses.length;
  return courses.map((course) => ({
    ...course,
    courseType: trustworthy && flagged.includes(course) ? "LK" : "GK",
  }));
}

/** Current year and intervals, the student's courses (with LK/GK) and grading scale. */
export async function getSchoolContext(studentId) {
  const today = new Date();
  const [years, groups] = await Promise.all([fetchYears(), fetchGroups(studentId)]);

  const year = pickCurrentOrLast(years, today);
  const courseGroups = groups.filter((g) => !g.isClass && g.subjects.length > 0);

  // The interval of the student's Endnoten, else the Jahrgang from group names.
  let intervalType = null;
  try {
    const finalgrades = await fetchFinalgrades(studentId, { yearId: year?.id });
    const intervalId = finalgrades.find((fg) => fg.interval_id)?.interval_id;
    intervalType = year?.intervals.find((i) => i.id === intervalId)?.type ?? null;
  } catch {
    // Endnoten are optional; the group-name fallback below still works.
  }
  if (!intervalType) {
    const jahrgaenge = courseGroups.map(jahrgangFromGroup).filter((n) => n !== null);
    intervalType = intervalTypeFromJahrgang(jahrgaenge.length ? Math.min(...jahrgaenge) : null);
  }

  const intervals = (year?.intervals ?? []).filter((i) => i.type === intervalType);
  const interval = pickCurrentOrLast(intervals, today);

  const courses = resolveCourseTypes(
    courseGroups.map((group) => ({
      groupId: group.id,
      localId: group.localId,
      subjectId: group.subjects[0].id,
      name: group.subjects[0].name,
      short: group.subjects[0].short,
    }))
  );

  return {
    scale: scaleForIntervalType(intervalType),
    intervalType,
    year,
    intervals,
    interval,
    courses,
  };
}
