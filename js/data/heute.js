import {
  fetchDayPlans,
  fetchCurrentTimetable,
  fetchGrades,
  fetchJournalNotes,
  isoDate,
} from "./repository.js";

const RECENT_GRADE_WINDOW_DAYS = 14;
const NOTE_WINDOW_DAYS = 14;
const MAX_NOTES = 6;
// "Stundenthema" records what a lesson covered — backward-looking, not a to-do.
const BACKWARD_LOOKING_NOTE_TYPES = new Set(["STU"]);

function germanWeekdayDate(date) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

/** API weekday is 1 = Monday … 7 = Sunday; JS getDay() is 0 = Sunday. */
function apiWeekday(date) {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function isoWeek(date) {
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
function weekTypeFor(timetable, date) {
  const { week, year } = isoWeek(date);
  const entry = (timetable.weeks ?? []).find((w) => w.nr === week && String(w.year) === String(year));
  return entry?.types?.[0] ?? null;
}

function timetableLessonsFor(timetable, date) {
  const weekday = apiWeekday(date);
  const weekType = weekTypeFor(timetable, date);
  return (timetable.lessons ?? []).filter((lesson) => {
    if (lesson.weekday !== weekday) return false;
    if (!weekType || !lesson.weeks?.length) return true;
    return lesson.weeks.includes(weekType);
  });
}

/**
 * The day plan marks a lesson only as changed/cancelled, so compare it with
 * the base timetable to tell a room change from a stand-in teacher — the
 * design needs those distinguishable without relying on colour.
 */
function refineChangedLessons(planLessons, timetable, date) {
  const baseByPeriod = new Map(timetableLessonsFor(timetable, date).map((l) => [l.period, l]));

  return planLessons.map((lesson) => {
    if (lesson.status !== "changed") return lesson;

    const base = baseByPeriod.get(lesson.period);
    const roomChanged = base?.room && lesson.room && base.room !== lesson.room;
    const teacherChanged = base?.teacher && lesson.teacher && base.teacher !== lesson.teacher;

    if (teacherChanged) return { ...lesson, status: "substitution", previousTeacher: base.teacher };
    if (roomChanged) return { ...lesson, status: "room_change", previousRoom: base.room };
    return { ...lesson, status: "substitution" };
  });
}

function changeText(lesson) {
  if (lesson.status === "cancelled") return `${lesson.period}. Std ${lesson.subject} entfällt`;
  // A note from the school ("Aufgaben im Raum bearbeiten") says more about
  // what actually changed than a room or teacher diff does, so it wins.
  const note = lesson.notes?.[0];
  if (note) return `${lesson.period}. Std ${lesson.subject} · ${note}`;
  if (lesson.status === "room_change") {
    return `${lesson.period}. Std ${lesson.subject} · ${lesson.previousRoom} → ${lesson.room}`;
  }
  return `${lesson.period}. Std ${lesson.subject}${lesson.teacher ? ` · ${lesson.teacher}` : ""}`;
}

/**
 * Aggregates the "Heute" screen: today's lessons with their status, a change
 * summary, the newest grade and upcoming Klassenbuch entries.
 * @param {number} studentId
 * @param {import('../domain/grades.js').GradeScale} scale
 */
export async function getHeuteData(studentId, scale) {
  const today = new Date();
  const todayIso = isoDate(today);
  const notesUntilIso = isoDate(new Date(today.getTime() + NOTE_WINDOW_DAYS * 86_400_000));

  const [dayPlans, timetable, grades, notes] = await Promise.all([
    fetchDayPlans(todayIso, todayIso),
    fetchCurrentTimetable(),
    fetchGrades(studentId, { scale }),
    fetchJournalNotes(studentId, todayIso, notesUntilIso),
  ]);

  const plan = dayPlans.find((day) => day.date === todayIso) ?? null;
  const lessons = plan
    ? refineChangedLessons(plan.lessons, timetable, today)
    : timetableLessonsFor(timetable, today)
        .map((l) => ({ ...l, status: "regular", notes: [] }))
        .sort((a, b) => a.period - b.period);

  const changes = lessons
    .filter((l) => l.status !== "regular")
    .map((l) => ({ status: l.status, text: changeText(l) }));

  const sortedGrades = [...grades].sort((a, b) => new Date(b.givenAt) - new Date(a.givenAt));
  const newest = sortedGrades[0];
  const withinWindow =
    newest && (today - new Date(newest.givenAt)) / 86_400_000 <= RECENT_GRADE_WINDOW_DAYS;

  // A double period records the same Klassenbuch entry once per lesson, each
  // with its own note id, so identical entries are collapsed by content.
  const uniqueNotes = [
    ...new Map(notes.map((n) => [`${n.date}|${n.subjectId}|${n.text}`, n])).values(),
  ];

  return {
    dateLabel: germanWeekdayDate(today),
    dayNotes: plan?.notes ?? [],
    lessons,
    changes,
    newestGrade: withinWindow ? newest : null,
    notes: uniqueNotes
      .filter((n) => !BACKWARD_LOOKING_NOTE_TYPES.has(n.typeCode) && n.text)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, MAX_NOTES),
  };
}
