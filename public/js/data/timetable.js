import { isoDate } from "./repository.js";

// Shared logic for turning a base timetable + a published day plan into the
// per-day lesson list with status, used by both Heute (one day) and
// Stundenplan (a five-day grid). Kept separate from repository.js because it
// doesn't fetch anything — it only merges data callers already have.

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

/**
 * Timetables alternate between A and B weeks; the timetable's own `weeks`
 * calendar says which ISO week is which.
 */
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
 * The day plan marks a lesson only as "changed", so compare it with the base
 * timetable to tell what actually changed — a stand-in teacher and a room
 * change need to read differently (the design distinguishes both without
 * relying on colour). Some "changed" entries carry neither a teacher nor a
 * room diff (e.g. a note like "Aufgaben von Frau X im Raum bearbeiten" where
 * the regular teacher is still on record) — those stay "changed" rather than
 * being mislabelled "substitution", which specifically means a stand-in.
 */
export function refineChangedLessons(planLessons, timetable, date) {
  const baseByPeriod = new Map(timetableLessonsFor(timetable, date).map((l) => [l.period, l]));

  return planLessons.map((lesson) => {
    if (lesson.status !== "changed") return lesson;

    const base = baseByPeriod.get(lesson.period);
    const { movedTo, movedFrom } = diffRooms(base?.roomList, lesson.roomList);
    const teacherChanged = base?.teacher && lesson.teacher && base.teacher !== lesson.teacher;

    if (teacherChanged) {
      return {
        ...lesson,
        status: "substitution",
        previousTeacher: base.teacher,
        previousTeacherShort: base.teacherShort,
      };
    }
    if (movedTo) {
      return {
        ...lesson,
        status: "room_change",
        // Show where the lesson has moved to, not the raw list that still
        // carries the old room alongside the new one.
        room: movedTo,
        previousRoom: movedFrom,
      };
    }
    return { ...lesson, status: "changed" };
  });
}

/**
 * A relocated lesson lists the original room *and* the new one in the same
 * `rooms` array, alphabetically, so "218 → 206, 218" was the whole array
 * being printed as the destination. The new room is whichever entry the
 * timetable doesn't already have.
 *
 * @returns {{ movedTo?: string, movedFrom?: string }} empty when nothing moved
 */
function diffRooms(baseRooms, planRooms) {
  const before = baseRooms ?? [];
  const after = planRooms ?? [];
  if (!before.length || !after.length) return {};

  const added = after.filter((room) => !before.includes(room));
  // Nothing added means the lesson stayed put (a cancellation lists its
  // original room unchanged, for instance).
  if (!added.length) return {};

  return { movedTo: added.join(", "), movedFrom: before.join(", ") };
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
