import {
  fetchDayPlans,
  fetchCurrentTimetable,
  fetchGrades,
  fetchGradeNotifications,
  fetchJournalNotes,
  fetchRole,
  isoDate,
} from "./repository.js";
import { lessonsForDate } from "./timetable.js";
import { terminCategory, withExamDetails } from "./termine.js";
import { getPlannedKlausuren } from "./klausuren.js";
import { resolveSchoolDay, schoolDayLabel } from "../domain/school-day.js";
import { getCutoffHour } from "../state/settings.js";
import { calendarDaysBetween } from "../util/format.js";
import { markNewGrades } from "../domain/grades.js";

const RECENT_GRADE_WINDOW_DAYS = 14;
const NOTE_WINDOW_DAYS = 14;
const MAX_NOTES = 6;

function germanWeekdayDate(date) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function changeText(lesson) {
  if (lesson.status === "cancelled") return `${lesson.period}. Std ${lesson.subject} entfällt`;
  // The school's note says more than a room or teacher diff.
  const note = lesson.notes?.[0];
  if (note) return `${lesson.period}. Std ${lesson.subject} · ${note}`;
  if (lesson.status === "room_change") {
    return `${lesson.period}. Std ${lesson.subject} · ${lesson.previousRoom} → ${lesson.room}`;
  }
  return `${lesson.period}. Std ${lesson.subject}${lesson.teacher ? ` · ${lesson.teacher}` : ""}`;
}

/**
 * The most recently entered grade and that date, or null if it was over 14
 * days ago.
 * given_at is the Leistung's date, so a Klausur graded weeks later would sink;
 * the bell feed's created_at says when it was entered. Grades missing from the
 * feed fall back to given_at; same-day ties go to the higher (later) id.
 */
export function newestGrade(grades, gradeNotifications, now) {
  const enteredAt = new Map();
  for (const { gradeId, createdAt } of gradeNotifications) {
    if (gradeId == null || !createdAt) continue;
    if (createdAt > (enteredAt.get(gradeId) ?? "")) enteredAt.set(gradeId, createdAt);
  }

  const newest = grades
    .map((grade) => ({ grade, date: enteredAt.get(grade.id) ?? grade.givenAt }))
    .filter((entry) => entry.date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.grade.id - a.grade.id)[0];

  if (!newest) return null;
  const age = calendarDaysBetween(newest.date.slice(0, 10), isoDate(now));
  return age <= RECENT_GRADE_WINDOW_DAYS ? newest : null;
}

/**
 * The "Heute" screen. "Today" is the day shown, which after the cutoff is the
 * next school day.
 * @param {number} studentId
 * @param {import('../domain/grades.js').GradeScale} scale
 */
export async function getHeuteData(studentId, scale) {
  const now = new Date();

  // The timetable's holidays decide the day, so it loads first.
  const timetable = await fetchCurrentTimetable();
  const day = resolveSchoolDay(now, getCutoffHour(), timetable.noSchoolDates);
  const dayIso = isoDate(day);
  const notesUntilIso = isoDate(new Date(day.getTime() + NOTE_WINDOW_DAYS * 86_400_000));

  const [dayPlans, grades, gradeNotifications, notes, planned, role] = await Promise.all([
    // The whole Anstehend window, so a test's sheet shows its day's room.
    fetchDayPlans(dayIso, notesUntilIso),
    fetchGrades(studentId, { scale }),
    // Optional: without the feed, Letzte Note falls back to given_at.
    fetchGradeNotifications().catch(() => []),
    fetchJournalNotes(studentId, dayIso, notesUntilIso),
    getPlannedKlausuren(studentId, dayIso, notesUntilIso),
    fetchRole(),
  ]);

  const lessons = lessonsForDate(day, dayPlans, timetable);
  const dayNotes = dayPlans.find((d) => d.date === dayIso)?.notes ?? [];

  const changes = lessons
    .filter((l) => l.status !== "regular")
    .map((l) => ({
      status: l.status,
      // Kept apart: only the lesson is struck through, not "entfällt".
      label: `${l.period}. Std ${l.subject}`,
      text: changeText(l),
    }));

  const uniqueNotes = withExamDetails(notes, dayPlans, timetable, isoDate(now), planned);

  return {
    title: schoolDayLabel(day, now),
    dateLabel: germanWeekdayDate(day),
    dayNotes,
    lessons,
    changes,
    newestGrade: newestGrade(markNewGrades(grades, role), gradeNotifications, now),
    notes: uniqueNotes
      // Plan Klausuren have no text.
      .filter((n) => terminCategory(n) !== null && (n.text || n.isExam))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, MAX_NOTES),
  };
}
