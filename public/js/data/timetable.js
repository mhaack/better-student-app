import { isoDate } from "./repository.js";

// Merges the base timetable with the published day plan into lessons with a
// status, for Heute and Stundenplan. Fetches nothing.

/** API weekday is 1 = Monday … 7 = Sunday; JS getDay() is 0 = Sunday. */
export function apiWeekday(date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    week: Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7),
    year: d.getUTCFullYear(),
  };
}

/** A/B weeks: the timetable's `weeks` calendar maps ISO weeks to them. */
export function weekTypeFor(timetable, date) {
  const { week, year } = isoWeek(date);
  const entry = (timetable.weeks ?? []).find((w) => w.nr === week && String(w.year) === String(year));
  return entry?.types?.[0] ?? null;
}

export function timetableLessonsFor(timetable, date) {
  const weekday = apiWeekday(date);
  const weekType = weekTypeFor(timetable, date);
  return (timetable.lessons ?? []).filter((lesson) => {
    if (lesson.weekday !== weekday) return false;
    if (!weekType || !lesson.weeks?.length) return true;
    return lesson.weeks.includes(weekType);
  });
}

/**
 * The plan only says "changed"; the diff against the timetable tells a
 * substitution from a room change. Entries with neither (often just a note)
 * stay "changed".
 */
export function refineChangedLessons(planLessons, timetable, date) {
  const baseByPeriod = new Map(timetableLessonsFor(timetable, date).map((l) => [l.period, l]));

  return planLessons.map((lesson) => {
    if (lesson.status !== "changed") return lesson;

    const base = baseByPeriod.get(lesson.period);
    const rooms = diffList(base?.roomList, lesson.roomList);
    const teachers = diffList(base?.teacherList, lesson.teacherList);

    if (teachers.added) {
      const shorts = diffList(base?.teacherShortList, lesson.teacherShortList);
      return {
        ...lesson,
        status: "substitution",
        // Only the stand-in, not the regular teacher listed beside them.
        teacher: teachers.added,
        teacherShort: shorts.added ?? lesson.teacherShort,
        previousTeacher: teachers.previous,
        previousTeacherShort: shorts.previous ?? base?.teacherShort,
      };
    }
    if (rooms.added) {
      return {
        ...lesson,
        status: "room_change",
        // Only the new room, not the old one listed beside it.
        room: rooms.added,
        previousRoom: rooms.previous,
      };
    }
    return { ...lesson, status: "changed" };
  });
}

/**
 * A changed lesson lists old and new entries in one array; the new one is
 * whatever the timetable doesn't have.
 *
 * @returns {{ added?: string, previous?: string }} empty when nothing was added
 */
function diffList(baseList, planList) {
  const before = baseList ?? [];
  const after = planList ?? [];
  if (!before.length || !after.length) return {};

  const added = after.filter((entry) => !before.includes(entry));
  // Nothing added, nothing changed (e.g. a cancellation keeps its room).
  if (!added.length) return {};

  return { added: added.join(", "), previous: before.join(", ") };
}

/**
 * The lessons for one calendar date: the published day plan when there is
 * one, otherwise the base timetable alone (every lesson "regular").
 */
export function lessonsForDate(date, dayPlans, timetable) {
  const dateIso = isoDate(date);
  const plan = dayPlans.find((day) => day.date === dateIso) ?? null;
  if (plan) return refineChangedLessons(plan.lessons, timetable, date);
  return timetableLessonsFor(timetable, date)
    .map((l) => ({ ...l, status: "regular", notes: [] }))
    .sort((a, b) => a.period - b.period);
}
