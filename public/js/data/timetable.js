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
    const rooms = diffList(base?.roomList, lesson.roomList);
    const teachers = diffList(base?.teacherList, lesson.teacherList);

    if (teachers.added) {
      const shorts = diffList(base?.teacherShortList, lesson.teacherShortList);
      return {
        ...lesson,
        status: "substitution",
        // Show who's standing in, not the raw list that still carries the
        // regular teacher alongside them.
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
        // Show where the lesson has moved to, not the raw list that still
        // carries the old room alongside the new one.
        room: rooms.added,
        previousRoom: rooms.previous,
      };
    }
    return { ...lesson, status: "changed" };
  });
}

/**
 * A changed lesson lists the original entries *and* the new ones in the same
 * array — rooms ("218 → 206, 218" was the whole array being printed as the
 * destination) and teachers alike ("Raupach → Kaiser, Raupach"). What's new
 * is whichever entry the timetable doesn't already have.
 *
 * @returns {{ added?: string, previous?: string }} empty when nothing was added
 */
function diffList(baseList, planList) {
  const before = baseList ?? [];
  const after = planList ?? [];
  if (!before.length || !after.length) return {};

  const added = after.filter((entry) => !before.includes(entry));
  // Nothing added means nothing changed hands (a cancellation lists its
  // original room unchanged, for instance).
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
