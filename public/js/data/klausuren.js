// The school's fixed Klausur plan for Jahrgang 11 and 12, published for the
// whole year up front (public/data/klausuren_<Jahrgang>_<YYYY>_<YY>.json).
// Not every teacher enters these in beste.schule, so the plan fills the gaps:
// beste.schule's own tests always win, and a plan entry only shows when
// beste.schule has no test for that day and Kurs.
//
// The plan names Kurse the way groups are named, minus the Jahrgang prefix:
// "MA1" is the group "11MA1", "la1" is "11-12la1". Case matters -- "MA1" (LK)
// and "ma1" (GK) are different Kurse with different dates.

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
 * The plan entries for the student's own Kurse, shaped like the exams
 * `examsFromNotes()` returns. Periods are the Kurs's lessons that day in the
 * base timetable; the plan itself has none. Some groups come back with an
 * empty `subjects[]` ("11gh1"), so the subject falls back to the timetable
 * lesson of that group, then to the Kurs code.
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
 * Notes' exams, plus every plan Klausur that no beste.schule test covers.
 * "Covers" is the same day and subject; a plan entry without a subject falls
 * back to the teacher code (journal notes carry codes). beste.schule's
 * details win, but the plan's Dauer is added to a covering Klausur (KLA),
 * which the Klassenbuch never records. A smaller test (LEI) on that day
 * still hides the plan entry without taking its Dauer: it is a different,
 * shorter test.
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
