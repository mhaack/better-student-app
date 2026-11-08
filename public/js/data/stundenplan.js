import { fetchDayPlans, fetchCurrentTimetable, fetchJournalNotes, isoDate } from "./repository.js";
import { apiWeekday, lessonsForDate } from "./timetable.js";
import { examsFromNotes, homeworkFromNotes, attachExams, attachHomework, withBellTimes } from "./termine.js";
import { getPlannedKlausuren, withPlannedKlausuren } from "./klausuren.js";
import { calendarDaysBetween, countdownLabel, formatDayMonth } from "../util/format.js";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr"];

/** Midnight on the Monday of `date`'s week. */
function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (apiWeekday(d) - 1));
  return d;
}

/** setDate, not milliseconds: days are 23 or 25 hours long across DST. */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** This week's Monday, or next week's once the weekend starts. */
export function resolveWeekStart(today) {
  const monday = mondayOf(today);
  const weekday = apiWeekday(today);
  return weekday >= 6 ? addDays(monday, 7) : monday;
}

/** Tests and homework of the week. A failed journal call costs the markers, never the grid. */
async function fetchWeekNotes(studentId, fromIso, toIso) {
  if (!studentId) return { exams: [], homework: [] };
  const [notes, planned] = await Promise.all([
    fetchJournalNotes(studentId, fromIso, toIso).catch(() => []),
    getPlannedKlausuren(studentId, fromIso, toIso),
  ]);
  return {
    exams: withPlannedKlausuren(examsFromNotes(notes), planned),
    homework: homeworkFromNotes(notes),
  };
}

/**
 * The Mo-Fr grid: a row per period used on any day, cells are lessons or
 * empty. One plan call per week. The caller clamps `weekOffset`.
 */
export async function getStundenplanData(weekOffset = 0, studentId = null) {
  const today = new Date();
  const weekStart = addDays(resolveWeekStart(today), weekOffset * 7);
  const dates = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));

  const fromIso = isoDate(dates[0]);
  const toIso = isoDate(dates[4]);
  const todayIso = isoDate(today);

  const [dayPlans, timetable, { exams, homework }] = await Promise.all([
    fetchDayPlans(fromIso, toIso),
    fetchCurrentTimetable(),
    fetchWeekNotes(studentId, fromIso, toIso),
  ]);

  const days = attachHomework(
    attachExams(
      dates.map((date, index) => ({
        date,
        iso: isoDate(date),
        label: WEEKDAY_LABELS[index],
        dateLabel: formatDayMonth(isoDate(date)),
        isToday: isoDate(date) === todayIso,
        countdown: countdownLabel(calendarDaysBetween(todayIso, isoDate(date))),
        lessons: withBellTimes(lessonsForDate(date, dayPlans, timetable), timetable),
      })),
      exams,
      timetable,
      todayIso
    ),
    homework
  );

  const maxPeriod = Math.max(1, ...days.flatMap((d) => d.lessons.map((l) => l.period)));
  const grid = Array.from({ length: maxPeriod }, (_, i) => {
    const period = i + 1;
    return {
      period,
      cells: days.map((day) => day.lessons.find((l) => l.period === period) ?? null),
    };
  });

  const changeCount = days.reduce((sum, d) => sum + d.lessons.filter((l) => l.status !== "regular").length, 0);
  const testCount = days.reduce((sum, d) => sum + d.exams.length, 0);
  const homeworkCount = days.reduce((sum, d) => sum + d.homework.length, 0);

  // Weeks ahead of the calendar week, counting the weekend auto-jump.
  const weeksFromNow = Math.round((weekStart.getTime() - mondayOf(today).getTime()) / (7 * 86_400_000));

  return {
    days,
    grid,
    changeCount,
    testCount,
    homeworkCount,
    weeksFromNow,
  };
}
