// The "Termine" screen: upcoming Klassenarbeiten, Klausuren and
// Leistungskontrollen. There is no exams endpoint; they are KLA/LEI notes on
// journal/lessons, entered months ahead. The note-type filter 500s on every
// value, so filtering happens here.

import { fetchJournalNotes, isoDate } from "./repository.js";
import { lessonsForDate } from "./timetable.js";
import { calendarDaysBetween, countdownLabel, periodLabel } from "../util/format.js";
import { getPlannedKlausuren, withPlannedKlausuren } from "./klausuren.js";

// HAU is left out: it's entered on the day, not ahead.
const EXAM_TYPE_CODES = new Set(["KLA", "LEI"]);

const noteKey = (note) => `${note.date}|${note.subjectId}|${note.text}`;

// A plan Klausur has no text, so its id keeps it apart.
const examKey = (exam) => (exam.source === "plan" ? exam.id : noteKey(exam));

const isExamNote = (note) => EXAM_TYPE_CODES.has(note.typeCode) && Boolean(note.text);

/**
 * A double period repeats the note once per lesson. Collapse by content,
 * keeping every period ("1.-2. Stunde").
 */
export function mergeDoublePeriods(notes) {
  const byContent = new Map();

  for (const note of notes) {
    const key = noteKey(note);
    const existing = byContent.get(key);
    if (existing) {
      existing.periods.push(note.period);
      continue;
    }
    byContent.set(key, { ...note, periods: [note.period] });
  }

  return [...byContent.values()].map((note) => {
    const periods = [...new Set(note.periods.filter((p) => p != null))].sort((a, b) => a - b);
    return { ...note, periods, periodLabel: periodLabel(periods) };
  });
}

/** KLA/LEI notes as exams, double periods merged, ordered by date and period. */
export function examsFromNotes(notes) {
  return mergeDoublePeriods(notes.filter(isExamNote)).sort(
    (a, b) => a.date.localeCompare(b.date) || (a.periods[0] ?? 0) - (b.periods[0] ?? 0)
  );
}

const joinUnique = (values) => [...new Set(values.filter(Boolean))].join(", ") || undefined;

/**
 * Joins each exam to its day's lessons (same period and subject). Room and
 * teacher come from the grid so changes show; times from the timetable, as
 * plan lessons have none.
 */
export function attachExams(days, exams, timetable, todayIso) {
  const bell = new Map();
  for (const l of timetable?.lessons ?? []) {
    if (l.from && l.to && !bell.has(l.period)) bell.set(l.period, { from: l.from, to: l.to });
  }

  return days.map((day) => {
    const dayExams = exams.filter((e) => e.date === day.iso);
    const examLessons = new Set();

    const attached = dayExams.map((exam) => {
      const lessons = exam.periods
        .map((p) => day.lessons.find((l) => l.period === p))
        .filter((l) => l && (exam.subjectId == null || l.subjectId == null || l.subjectId === exam.subjectId));
      for (const l of lessons) examLessons.add(l);
      const present = lessons.filter((l) => l.status !== "cancelled");

      const start = bell.get(exam.periods[0])?.from;
      const end = bell.get(exam.periods.at(-1))?.to;

      return {
        ...exam,
        timeLabel: [periodLabel(exam.periods), start && end ? `${start}–${end}` : "", exam.durationLabel]
          .filter(Boolean)
          .join(" · "),
        room: joinUnique(present.map((l) => l.room)),
        teacher: joinUnique(present.map((l) => l.teacher)),
        countdown: countdownLabel(calendarDaysBetween(todayIso, exam.date)),
      };
    });

    return {
      ...day,
      exams: attached,
      lessons: day.lessons.map((l) => (examLessons.has(l) ? { ...l, hasExam: true } : l)),
    };
  });
}

/**
 * Notes merged by double period; exams get the test sheet's fields, and
 * plan Klausuren no note covers are appended.
 */
export function withExamDetails(notes, dayPlans, timetable, todayIso, planExams = []) {
  const merged = mergeDoublePeriods(notes);
  const exams = withPlannedKlausuren(merged.filter(isExamNote), planExams);
  const added = exams.filter((e) => e.source === "plan");
  const days = [...new Set(exams.map((e) => e.date))].map((iso) => ({
    iso,
    lessons: lessonsForDate(new Date(`${iso}T00:00:00`), dayPlans, timetable),
  }));
  const detailed = new Map(
    attachExams(days, exams, timetable, todayIso)
      .flatMap((d) => d.exams)
      .map((e) => [examKey(e), { ...e, isExam: true }])
  );
  return [...merged, ...added].map((n) => detailed.get(examKey(n)) ?? n);
}

/**
 * @param {number} studentId
 * @param {{ yearEnd?: string }} [options] last day of the school year, so the
 *   query covers it all; defaults to twelve months out.
 */
export async function getTermineData(studentId, options = {}) {
  const today = isoDate(new Date());
  const until =
    options.yearEnd && options.yearEnd > today
      ? options.yearEnd
      : isoDate(new Date(Date.now() + 365 * 86_400_000));

  const [notes, planned] = await Promise.all([
    fetchJournalNotes(studentId, today, until),
    getPlannedKlausuren(studentId, today, until),
  ]);

  const exams = withPlannedKlausuren(examsFromNotes(notes), planned);

  return {
    // Flat; the view groups by month, mixing in holidays.
    exams,
    count: exams.length,
  };
}
