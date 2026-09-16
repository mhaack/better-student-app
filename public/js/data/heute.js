import {
  fetchDayPlans,
  fetchCurrentTimetable,
  fetchGrades,
  fetchJournalNotes,
  isoDate,
} from "./repository.js";
import { lessonsForDate } from "./timetable.js";
import { resolveSchoolDay, schoolDayLabel } from "../domain/school-day.js";
import { getCutoffHour } from "../state/settings.js";

const RECENT_GRADE_WINDOW_DAYS = 14;
const NOTE_WINDOW_DAYS = 14;
const MAX_NOTES = 6;
// "Stundenthema" records what a lesson covered — backward-looking, not a to-do.
const BACKWARD_LOOKING_NOTE_TYPES = new Set(["STU"]);

function germanWeekdayDate(date) {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(date);
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
 * Aggregates the "Heute" screen. Once the school day is over the screen rolls
 * forward to the next one (see domain/school-day.js), so "today" here is the
 * day being shown, which is not necessarily the current date.
 * @param {number} studentId
 * @param {import('../domain/grades.js').GradeScale} scale
 */
export async function getHeuteData(studentId, scale) {
  const now = new Date();
  const day = resolveSchoolDay(now, getCutoffHour());
  const dayIso = isoDate(day);
  const notesUntilIso = isoDate(new Date(day.getTime() + NOTE_WINDOW_DAYS * 86_400_000));

  const [dayPlans, timetable, grades, notes] = await Promise.all([
    fetchDayPlans(dayIso, dayIso),
    fetchCurrentTimetable(),
    fetchGrades(studentId, { scale }),
    fetchJournalNotes(studentId, dayIso, notesUntilIso),
  ]);

  const lessons = lessonsForDate(day, dayPlans, timetable);
  const dayNotes = dayPlans.find((d) => d.date === dayIso)?.notes ?? [];

  const changes = lessons
    .filter((l) => l.status !== "regular")
    .map((l) => ({
      status: l.status,
      // The design strikes through just the lesson itself and leaves
      // "entfällt" upright, so the two parts stay separate.
      label: `${l.period}. Std ${l.subject}`,
      text: changeText(l),
    }));

  const sortedGrades = [...grades].sort((a, b) => new Date(b.givenAt) - new Date(a.givenAt));
  const newest = sortedGrades[0];
  const withinWindow =
    newest && (now - new Date(newest.givenAt)) / 86_400_000 <= RECENT_GRADE_WINDOW_DAYS;

  // A double period records the same Klassenbuch entry once per lesson, each
  // with its own note id, so identical entries are collapsed by content.
  const uniqueNotes = [
    ...new Map(notes.map((n) => [`${n.date}|${n.subjectId}|${n.text}`, n])).values(),
  ];

  return {
    // "Heute" / "Morgen" / "Montag" — the heading has to say which day this is.
    title: schoolDayLabel(day, now),
    dateLabel: germanWeekdayDate(day),
    dayNotes,
    lessons,
    changes,
    newestGrade: withinWindow ? newest : null,
    notes: uniqueNotes
      .filter((n) => !BACKWARD_LOOKING_NOTE_TYPES.has(n.typeCode) && n.text)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, MAX_NOTES),
  };
}
