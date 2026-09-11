import {
  fetchCurrentTimetable,
  fetchSubstitutions,
  fetchGrades,
  fetchHomework,
  fetchSubjects,
  isoDate,
} from "./repository.js";
import { mergeLessonsWithSubstitutions } from "../api/mappers.js";

const RECENT_GRADE_WINDOW_DAYS = 14;
const HOMEWORK_WINDOW_DAYS = 14;

function germanWeekdayDate(date) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function daysBetween(aIso, bDate) {
  const a = new Date(aIso);
  return Math.round((bDate - a) / 86_400_000);
}

/**
 * Aggregates the "Heute" screen: today's lessons (merged with substitutions),
 * a change summary card, the newest grade, and homework due soon.
 * @param {number} studentId
 * @param {import('../domain/grades.js').GradeScale} scale
 */
export async function getHeuteData(studentId, scale) {
  const today = new Date();
  const todayIso = isoDate(today);
  const homeworkUntilIso = isoDate(new Date(today.getTime() + HOMEWORK_WINDOW_DAYS * 86_400_000));

  const [timetable, substitutions, grades, homework, subjects] = await Promise.all([
    fetchCurrentTimetable(),
    fetchSubstitutions(todayIso, todayIso),
    fetchGrades(studentId, { scale }),
    fetchHomework(studentId, todayIso, homeworkUntilIso),
    fetchSubjects(studentId),
  ]);
  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));

  const todaysRegularLessons = (timetable?.data?.lessons ?? []).filter((lesson) => {
    const dow = lesson.day_of_week ?? lesson.dayOfWeek;
    return dow === undefined || dow === today.getDay();
  });

  const lessons = mergeLessonsWithSubstitutions(todaysRegularLessons, substitutions);

  const changes = lessons
    .filter((l) => l.status !== "regular")
    .map((l) => ({
      status: l.status,
      text:
        l.status === "cancelled"
          ? `${l.period}. Std ${l.subject} entfällt`
          : l.previousRoom
            ? `${l.period}. Std ${l.subject} · ${l.previousRoom} → ${l.room}`
            : `${l.period}. Std ${l.subject}${l.teacher ? ` · ${l.teacher}` : ""}`,
    }));

  const sortedGrades = [...grades].sort((a, b) => new Date(b.givenAt) - new Date(a.givenAt));
  const newest = sortedGrades[0];
  const newestGrade =
    newest && Math.abs(daysBetween(newest.givenAt, today)) <= RECENT_GRADE_WINDOW_DAYS
      ? { ...newest, subjectName: subjectNameById.get(newest.subjectId) }
      : null;

  const dueHomework = homework
    .filter((h) => h.due)
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  return {
    dateLabel: germanWeekdayDate(today),
    lessons,
    changes,
    newestGrade,
    homework: dueHomework,
  };
}
