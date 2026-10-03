// The school's Klausur plan for Jahrgang 11/12 (public/data/klausuren_*.json)
// fills gaps where teachers didn't enter a test; beste.schule's tests win.
// Kurse are group names minus the Jahrgang ("11MA1" → "MA1"), case-sensitive:
// "MA1" (LK) ≠ "ma1" (GK).

import { cached } from "./cache.js";
import { fetchGroups, fetchCurrentTimetable } from "./repository.js";
import { getSchoolContext } from "./context.js";
import { timetableLessonsFor } from "./timetable.js";
import { periodLabel } from "../util/format.js";

const JAHRGANG_BY_INTERVAL_TYPE = { "11er": 11, "12er": 12 };

const kursOf = (groupLocalId) => String(groupLocalId ?? "").replace(/^[0-9-]+/, "");

/** "11er" + a year starting 2026 -> "klausuren_11_2026_27.json"; null for Sek I. */
export function planFileName(intervalType, year) {
  const jahrgang = JAHRGANG_BY_INTERVAL_TYPE[intervalType];
  const startYear = Number(String(year?.from ?? "").slice(0, 4));
  if (!jahrgang || !startYear) return null;
  return `klausuren_${jahrgang}_${startYear}_${String(startYear + 1).slice(2)}.json`;
}

/** The plan is a bonus: a missing or broken file yields no Klausuren, never an error. */
export async function fetchKlausurPlan(file) {
  try {
    return await cached(
      `klausurplan:${file}`,
      async () => {
        const res = await fetch(`/data/${file}`);
        if (!res.ok) return [];
        const entries = await res.json();
        return Array.isArray(entries) ? entries : [];
      },
      { staleMs: 24 * 60 * 60_000 }
    );
  } catch {
    return [];
  }
}

/**
 * Plan entries for the student's Kurse, shaped like `examsFromNotes()`.
 * Periods come from the timetable. Some groups have empty `subjects[]`, so
 * the subject falls back to the timetable lesson, then the Kurs code.
 */
export function klausurenForStudent(entries, groups, timetable) {
  const groupByKurs = new Map(groups.filter((g) => !g.isClass).map((g) => [kursOf(g.localId), g]));
  const lessons = timetable?.lessons ?? [];

  return entries.flatMap((entry) => {
    const group = groupByKurs.get(entry.kurs);
    if (!group) return [];

    const groupLesson = lessons.find((l) => l.groupLocalId === group.localId && l.subjectId != null);
    const subject = group.subjects[0] ?? {
      id: groupLesson?.subjectId,
      name: groupLesson?.subject,
      short: groupLesson?.subjectShort,
    };
    const periods = timetableLessonsFor(timetable ?? {}, new Date(`${entry.date}T00:00:00`))
      .filter((l) => l.groupLocalId === group.localId)
      .map((l) => l.period)
      .sort((a, b) => a - b);
    const durationLabel = entry.duration ? `${entry.duration} Min.` : "";

    return [
      {
        id: `klausur:${entry.date}:${entry.kurs}`,
        source: "plan",
        date: entry.date,
        subject: subject.name ?? entry.kurs,
        subjectShort: subject.short,
        subjectId: subject.id,
        typeName: "Klausur",
        typeCode: "KLA",
        text: "",
        teacherShort: entry.teacher,
        duration: entry.duration,
        durationLabel,
        periods,
        periodLabel: [periodLabel(periods), durationLabel].filter(Boolean).join(" · "),
      },
    ];
  });
}

const sameDayAndKurs = (exam, plan) =>
  exam.date === plan.date &&
  (plan.subjectId != null
    ? exam.subjectId === plan.subjectId
    : String(exam.teacher ?? "").split(", ").includes(plan.teacherShort));

/**
 * Notes' exams plus plan Klausuren no test covers (same day and subject, or
 * teacher code). A covering KLA gains the plan's Dauer; a LEI hides the
 * entry but doesn't take it, being a shorter test.
 */
export function withPlannedKlausuren(noteExams, planExams) {
  const withDauer = noteExams.map((exam) => {
    const plan = exam.typeCode === "KLA" && planExams.find((p) => p.duration && sameDayAndKurs(exam, p));
    if (!plan) return exam;
    return {
      ...exam,
      duration: plan.duration,
      durationLabel: plan.durationLabel,
      periodLabel: [exam.periodLabel, plan.durationLabel].filter(Boolean).join(" · "),
    };
  });
  const uncovered = planExams.filter((plan) => !noteExams.some((exam) => sameDayAndKurs(exam, plan)));
  return [...withDauer, ...uncovered].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.periods[0] ?? 0) - (b.periods[0] ?? 0)
  );
}

/** The student's plan Klausuren in [fromIso, toIso]; [] on any failure. */
export async function getPlannedKlausuren(studentId, fromIso, toIso) {
  if (!studentId) return [];
  try {
    const context = await getSchoolContext(studentId);
    const file = planFileName(context.intervalType, context.year);
    if (!file) return [];
    const [entries, groups, timetable] = await Promise.all([
      fetchKlausurPlan(file),
      fetchGroups(studentId),
      fetchCurrentTimetable(),
    ]);
    const inRange = entries.filter((e) => e.date >= fromIso && e.date <= toIso);
    return klausurenForStudent(inRange, groups, timetable);
  } catch {
    return [];
  }
}
