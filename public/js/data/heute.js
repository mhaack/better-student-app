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
import { terminCategory, withExamDetails, attachExams, attachHomework, homeworkFromNotes, withBellTimes } from "./termine.js";
import { getPlannedKlausuren } from "./klausuren.js";
import { resolveSchoolDay, schoolDayLabel } from "../domain/school-day.js";
import { getCutoffHour } from "../state/settings.js";
import { calendarDaysBetween, countdownLabel, formatWeekday, formatWeekdayDate } from "../util/format.js";
import { markNewGrades } from "../domain/grades.js";

const RECENT_GRADE_WINDOW_DAYS = 14;
const NOTE_WINDOW_DAYS = 14;
const MAX_NOTES = 3;

/**
 * The grades entered on the most recent entry day, latest first, and that
 * date; null if it was over 14 days ago.
 * given_at is the Leistung's date, so a Klausur graded weeks later would sink;
 * the bell feed's created_at says when it was entered. Grades missing from the
 * feed fall back to given_at; same-day ties go to the higher (later) id.
 */
export function latestGrades(grades, gradeNotifications, now) {
  const enteredAt = new Map();
  for (const { gradeId, createdAt } of gradeNotifications) {
    if (gradeId == null || !createdAt) continue;
    if (createdAt > (enteredAt.get(gradeId) ?? "")) enteredAt.set(gradeId, createdAt);
  }

  const entries = grades
    .map((grade) => {
      const at = enteredAt.get(grade.id) ?? grade.givenAt ?? "";
      return { grade, at, day: at.slice(0, 10) };
    })
    .filter((entry) => entry.day)
    .sort((a, b) => b.at.localeCompare(a.at) || b.grade.id - a.grade.id);

  const date = entries[0]?.day;
  if (!date || calendarDaysBetween(date, isoDate(now)) > RECENT_GRADE_WINDOW_DAYS) return null;
  return { date, grades: entries.filter((e) => e.day === date).map((e) => e.grade) };
}

/**
 * The test card: the first test on the shown day or the day after. Its label
 * leaves out the day when the title already says it.
 */
export function upcomingTest(notes, dayIso, todayIso) {
  const test = notes
    .filter((n) => n.isExam && calendarDaysBetween(dayIso, n.date) >= 0 && calendarDaysBetween(dayIso, n.date) <= 1)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!test) return null;

  const daysAway = calendarDaysBetween(todayIso, test.date);
  const when = test.date === dayIso ? "" : daysAway === 1 ? "Morgen" : formatWeekday(test.date, "long");
  return {
    exam: test,
    label: [when, test.typeName].filter(Boolean).join(" · "),
    where: [test.timeLabel, test.room].filter(Boolean).join(" · "),
  };
}

/** Heute's Termine: the first few Klassenbuch entries by date, without the one in the test card. */
export function nextTermine(notes, skip = null) {
  return notes
    // Plan Klausuren have no text.
    .filter((n) => n !== skip && terminCategory(n) !== null && (n.text || n.isExam))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_NOTES)
    .map((n) => ({ ...n, category: terminCategory(n) }));
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
  const todayIso = isoDate(now);
  const notesUntilIso = isoDate(new Date(day.getTime() + NOTE_WINDOW_DAYS * 86_400_000));

  const [dayPlans, grades, gradeNotifications, notes, planned, role] = await Promise.all([
    // The whole Termine window, so a test's sheet shows its day's room.
    fetchDayPlans(dayIso, notesUntilIso),
    fetchGrades(studentId, { scale }),
    // Optional: without the feed, the Noten card falls back to given_at.
    fetchGradeNotifications().catch(() => []),
    fetchJournalNotes(studentId, dayIso, notesUntilIso),
    getPlannedKlausuren(studentId, dayIso, notesUntilIso),
    fetchRole(),
  ]);

  const uniqueNotes = withExamDetails(notes, dayPlans, timetable, todayIso, planned);
  // Same markers and sheets as the Stundenplan.
  const [shownDay] = attachHomework(
    attachExams(
      [
        {
          iso: dayIso,
          countdown: countdownLabel(calendarDaysBetween(todayIso, dayIso)),
          lessons: withBellTimes(lessonsForDate(day, dayPlans, timetable), timetable),
        },
      ],
      uniqueNotes.filter((n) => n.isExam),
      timetable,
      todayIso
    ),
    homeworkFromNotes(notes)
  );
  const test = upcomingTest(uniqueNotes, dayIso, todayIso);

  return {
    title: schoolDayLabel(day, now),
    dateLabel: formatWeekdayDate(dayIso, "long"),
    day: shownDay,
    changeCount: shownDay.lessons.filter((l) => l.status !== "regular").length,
    test,
    latestGrades: latestGrades(markNewGrades(grades, role), gradeNotifications, now),
    termine: nextTermine(uniqueNotes, test?.exam),
  };
}
