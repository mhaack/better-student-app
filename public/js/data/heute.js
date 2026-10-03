import {
  fetchDayPlans,
  fetchCurrentTimetable,
  fetchGrades,
  fetchJournalNotes,
  isoDate,
} from "./repository.js";
import { lessonsForDate } from "./timetable.js";
import { withExamDetails } from "./termine.js";
import { getPlannedKlausuren } from "./klausuren.js";
import { resolveSchoolDay, schoolDayLabel } from "../domain/school-day.js";
import { getCutoffHour } from "../state/settings.js";

const RECENT_GRADE_WINDOW_DAYS = 14;
const NOTE_WINDOW_DAYS = 14;
const MAX_NOTES = 6;
// Stundenthema looks back, it isn't a to-do.
const BACKWARD_LOOKING_NOTE_TYPES = new Set(["STU"]);

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

  const [dayPlans, grades, notes, planned] = await Promise.all([
    // The whole Anstehend window, so a test's sheet shows its day's room.
    fetchDayPlans(dayIso, notesUntilIso),
    fetchGrades(studentId, { scale }),
    fetchJournalNotes(studentId, dayIso, notesUntilIso),
    getPlannedKlausuren(studentId, dayIso, notesUntilIso),
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

  const sortedGrades = [...grades].sort((a, b) => new Date(b.givenAt) - new Date(a.givenAt));
  const newest = sortedGrades[0];
  const withinWindow =
    newest && (now - new Date(newest.givenAt)) / 86_400_000 <= RECENT_GRADE_WINDOW_DAYS;

  const uniqueNotes = withExamDetails(notes, dayPlans, timetable, isoDate(now), planned);

  return {
    title: schoolDayLabel(day, now),
    dateLabel: germanWeekdayDate(day),
    dayNotes,
    lessons,
    changes,
    newestGrade: withinWindow ? newest : null,
    notes: uniqueNotes
      // Plan Klausuren have no text.
      .filter((n) => !BACKWARD_LOOKING_NOTE_TYPES.has(n.typeCode) && (n.text || n.isExam))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, MAX_NOTES),
  };
}
