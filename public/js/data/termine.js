// The "Termine" screen: upcoming Klassenarbeiten, Klausuren, tests, homework
// and other Klassenbuch entries. There is no exams endpoint; they are notes on
// journal/lessons, exams entered months ahead. The note-type filter 500s on
// every value, so filtering happens here.

import { fetchJournalNotes, isoDate } from "./repository.js";
import { lessonsForDate } from "./timetable.js";
import { calendarDaysBetween, countdownLabel, periodLabel } from "../util/format.js";
import { getPlannedKlausuren, withPlannedKlausuren } from "./klausuren.js";

// Tab per note type; anything unknown is "Sonstiges".
const CATEGORY_BY_TYPE = { KLA: "exam", LEI: "exam", HAU: "hw" };
// Stundenthema records what a lesson covered; it isn't a Termin.
const BACKWARD_LOOKING_TYPES = new Set(["STU"]);
const CATEGORIES = ["exam", "hw", "other"];

const noteKey = (note) => `${note.date}|${note.subjectId}|${note.text}`;

// A plan Klausur has no text, so its id keeps it apart.
const examKey = (exam) => (exam.source === "plan" ? exam.id : noteKey(exam));

/** The Termine tab a Klassenbuch note belongs to, or null if it isn't a Termin. */
export function terminCategory(note) {
  if (BACKWARD_LOOKING_TYPES.has(note.typeCode)) return null;
  return CATEGORY_BY_TYPE[note.typeCode] ?? "other";
}

const isExam = (entry) => entry.category === "exam";
const isExamNote = (note) => Boolean(note.text) && terminCategory(note) === "exam";
const byDateAndPeriod = (a, b) => a.date.localeCompare(b.date) || (a.periods[0] ?? 0) - (b.periods[0] ?? 0);

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

/** Notes that are Termine, each with its `category`, double periods merged, by date and period. */
export function termineFromNotes(notes) {
  return mergeDoublePeriods(notes.filter((n) => n.text && terminCategory(n)))
    .map((n) => ({ ...n, category: terminCategory(n) }))
    .sort(byDateAndPeriod);
}

/** Just the Klassenarbeiten, Klausuren and tests. */
export function examsFromNotes(notes) {
  return termineFromNotes(notes).filter(isExam);
}

/** Entries before the next break (all of them when none is left): what the subtitles count. */
function untilNextFerien(entries, nextFerien) {
  return nextFerien ? entries.filter((e) => e.date < nextFerien.from) : entries;
}

/** Tab counts; "all" sums the entries, "ferien" is passed in (breaks plus free days). */
export function countByCategory(entries, ferienCount = 0) {
  const counts = { all: entries.length };
  for (const category of CATEGORIES) counts[category] = entries.filter((e) => e.category === category).length;
  counts.ferien = ferienCount;
  return counts;
}

/** Breaks and free days that haven't ended yet; one under way still counts. */
export function upcomingBlocks(blocks, todayIso) {
  return blocks.filter((block) => block.to >= todayIso);
}

/**
 * The rows of one tab: its entries with the breaks and free days that fall
 * between them, Alle always reaching the next break. On the Ferien tab, just
 * the breaks and free days passed in.
 * @returns {Array<{ date: string, termin?: object, ferien?: object }>}
 */
export function termineList(entries, filter, { nextFerien = null, ferien = [], freieTage = [] } = {}) {
  if (filter === "ferien") {
    return [...ferien, ...freieTage]
      .map((block) => ({ date: block.from, ferien: block }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  const shown = filter === "all" ? entries : entries.filter((e) => e.category === filter);
  const lastDate = shown.at(-1)?.date ?? "";
  const breaks = [...ferien, ...freieTage].filter(
    (block) => (shown.length && block.from <= lastDate) || (filter === "all" && block.from === nextFerien?.from)
  );
  return [
    ...shown.map((termin) => ({ date: termin.date, termin })),
    ...breaks.map((block) => ({ date: block.from, ferien: block })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

const NOUNS = {
  all: ["Termin", "Termine"],
  exam: ["Arbeit oder Test", "Arbeiten & Tests"],
  hw: ["Hausaufgabe", "Hausaufgaben"],
  other: ["sonstiger Termin", "sonstige Termine"],
};

const plural = (count, [one, many]) => `${count} ${count === 1 ? one : many}`;

/**
 * "3 Hausaufgaben bis zu den Herbstferien"; on the Ferien tab
 * "5 Ferien und 3 freie Tage im Schuljahr 2025/26".
 */
export function termineSubtitle(entries, filter, options = {}) {
  const { nextFerien = null, scale, ferienCount = 0, freieTageCount = 0, yearLabel = "" } = options;
  if (filter === "ferien") {
    // "Ferien" has no singular.
    const days = freieTageCount ? ` und ${plural(freieTageCount, ["freier Tag", "freie Tage"])}` : "";
    return `${ferienCount} Ferien${days} ${yearLabel ? `im ${yearLabel}` : "in diesem Schuljahr"}`;
  }
  const nouns =
    filter === "exam" && scale === "points_0_15" ? ["Klausur oder Test", "Klausuren & Tests"] : NOUNS[filter];
  // Klausuren are entered months ahead, so that tab looks at the whole year.
  const horizon = filter === "exam" ? null : nextFerien;
  const inTab = filter === "all" ? entries : entries.filter((e) => e.category === filter);
  const count = untilNextFerien(inTab, horizon).length;
  const until = horizon ? `bis zu den ${horizon.name}` : "in diesem Schuljahr";
  return `${plural(count, nouns)} ${until}`;
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

  const all = termineFromNotes(notes);
  // Only exams may cover a plan Klausur; homework on the same day must not hide it.
  // Plan Klausuren come without a category.
  const exams = withPlannedKlausuren(all.filter(isExam), planned).map((e) => ({ ...e, category: "exam" }));
  const entries = [...exams, ...all.filter((e) => !isExam(e))].sort(byDateAndPeriod);

  return {
    today,
    // Flat; the view groups by month, mixing in holidays.
    entries,
    // The dark card: the next exam, whatever tab is active.
    nextExam: exams[0] ?? null,
  };
}
