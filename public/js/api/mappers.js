// Raw beste.schule API JSON -> the normalized domain shapes from docs/plan.md §3.
//
// VERIFIED against the live API (2026-09) with a guardian token at a Saxon
// Gymnasium. Everything below reflects real responses, not guesses.
// Notable differences from the original plan's assumptions:
//   - people use `forename` + `name` (NOT firstname/lastname); `name` is the surname
//   - a student's class is `meta_groups[]` (meta: 1 = Tutorenkurs/Klasse),
//     and their courses are the groups they belong to (meta: 0)
//   - `subject` is NOT an allowed include on /api/grades; it only exists as
//     `collection.subject` (a grade belongs to a collection, which has the subject)
//   - `rooms` and `teachers` are ARRAYS; a room's label is `local_id`, not `name`
//   - a timetable lesson's period is `nr` and its day is `weekday` (1 = Monday),
//     with A/B week alternation via `weeks` + the timetable's `weeks[]` calendar
//   - substitution-plans/days returns the WHOLE day (every lesson), each with a
//     `status`: "initial" | "planned" | "canceled" — not just the changes
//   - interval carries `type`: "Sek I" | "11er" | "12er" — this is the grading
//     scale signal (Sek I = Noten 1-6, 11er/12er = Oberstufe, Punkte 0-15)
//   - finalgrades carry no value/formula for this school (calculation_for:
//     "teacher"), so subject averages are our own estimate ("geschätzt")

import { parseGrade } from "../domain/grades.js";

function pick(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/** "Maria Schmidt" from { forename: "Maria", name: "Schmidt" } — `name` is the surname. */
export function personName(person) {
  if (!person) return undefined;
  return [person.forename, person.name].filter(Boolean).join(" ") || undefined;
}

/** Rooms and staff are labelled by local_id ("210", "THR1", "KRC"). */
function localIds(items) {
  return (items ?? []).map((item) => item?.local_id).filter(Boolean);
}

function joined(list) {
  return list.length ? list.join(", ") : undefined;
}

/**
 * Room and teacher fields shared by timetable and plan lessons. The lists are
 * kept alongside the joined strings because a changed lesson carries both the
 * original entry and the new one in the same array — so telling them apart is
 * a set operation against the timetable, not something a string can express.
 */
function roomsAndTeachers(raw) {
  const roomList = localIds(raw.rooms);
  const teacherList = (raw.teachers ?? []).map(personName).filter(Boolean);
  const teacherShortList = localIds(raw.teachers);
  return {
    room: joined(roomList),
    roomList,
    teacher: joined(teacherList),
    teacherList,
    teacherShort: joined(teacherShortList),
    teacherShortList,
  };
}

export function mapStudent(raw) {
  const klasse = (raw.meta_groups ?? []).find((g) => g.meta === 1) ?? raw.meta_groups?.[0];
  return {
    id: raw.id,
    firstName: pick(raw, "nickname", "forename") ?? "",
    fullFirstName: raw.forename ?? "",
    lastName: raw.name ?? "",
    className: klasse?.name ?? klasse?.local_id ?? "",
  };
}

export function mapInterval(raw) {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    from: raw.from,
    to: raw.to,
    yearId: raw.year_id,
  };
}

/** /api/years returns each year with its intervals already nested. */
export function mapYear(raw) {
  return {
    id: raw.id,
    name: raw.name,
    from: raw.from,
    to: raw.to,
    intervals: (raw.intervals ?? []).map(mapInterval),
  };
}

/**
 * The two grading scales are distinguished by the interval's `type`:
 * "Sek I" uses Noten 1-6 (1 best), "11er"/"12er" use Punkte 0-15 (15 best).
 * @returns {import('../domain/grades.js').GradeScale}
 */
export function scaleForIntervalType(intervalType) {
  return intervalType === "Sek I" ? "grade_1_6" : "points_0_15";
}

export function mapSubject(raw) {
  return {
    id: raw.id,
    name: raw.name,
    short: raw.local_id,
  };
}

/**
 * Course groups. meta === 1 marks the Tutorenkurs/Klasse rather than a taught
 * course, so those are filtered out when listing a student's courses.
 */
export function mapGroup(raw) {
  return {
    id: raw.id,
    localId: raw.local_id,
    name: raw.name,
    isClass: raw.meta === 1,
    levelId: raw.level_id,
    subjects: (raw.subjects ?? []).map(mapSubject),
  };
}

/**
 * Leistungskurs detection. The API exposes no LK/GK field anywhere, so this
 * falls back to this school's naming convention: course groups are named
 * "<Jahrgang><subject code><nr>" with the subject code in UPPERCASE for
 * Leistungskurse and lowercase for Grundkurse (e.g. "11MA1" = LK Mathe,
 * "11ph2" = GK Physik). Verified against a Jahrgang-11 student who has
 * exactly the expected two uppercase groups. Callers must treat the result as
 * a hint: see resolveCourseTypes(), which discards it when it looks wrong.
 */
export function looksLikeLeistungskurs(group) {
  const code = String(group.localId ?? "").replace(/^[0-9-]+/, "").replace(/[0-9]+$/, "");
  return code.length > 0 && code === code.toUpperCase() && /[A-ZÄÖÜ]/.test(code);
}

export function mapGradeCollection(raw) {
  return {
    id: raw.id,
    // Free-text, school-configured label: "Sonstige", "Klausur", "Klassenarbeit", ...
    type: raw.type ?? "Sonstige",
    name: raw.name,
    weighting: Number(raw.weighting ?? 1),
    givenAt: raw.given_at,
    intervalId: raw.interval_id,
    intervalType: raw.interval?.type,
    subjectId: pick(raw, "subject_id") ?? raw.subject?.id,
    subjectName: raw.subject?.name,
  };
}

/**
 * @param {object} raw
 * @param {import('../domain/grades.js').GradeScale} scale
 */
export function mapGrade(raw, scale) {
  const collection = mapGradeCollection(raw.collection ?? {});
  return {
    id: raw.id,
    ...parseGrade(String(raw.value ?? ""), scale),
    // A grade has no subject of its own — it inherits its collection's.
    subjectId: collection.subjectId ?? raw.subject?.id,
    subjectName: collection.subjectName ?? raw.subject?.name,
    collection,
    givenAt: raw.given_at ?? collection.givenAt,
    teacher: personName(raw.teacher),
    read: Boolean(raw.read),
  };
}

const PLAN_STATUS = {
  initial: "regular",
  planned: "changed",
  canceled: "cancelled",
};

/**
 * One lesson from substitution-plans/days. `status` here is only "regular" /
 * "changed" / "cancelled"; distinguishing a room change from a teacher
 * substitution needs the base timetable, which js/data/heute.js layers on top.
 */
export function mapPlanLesson(raw) {
  return {
    id: raw.id,
    period: raw.nr,
    status: PLAN_STATUS[raw.status] ?? "regular",
    subject: raw.subject?.name,
    subjectShort: raw.subject?.local_id,
    subjectId: raw.subject?.id,
    ...roomsAndTeachers(raw),
    notes: (raw.notes ?? []).filter(Boolean),
  };
}

export function mapTimetableLesson(raw) {
  return {
    id: raw.id,
    weekday: raw.weekday,
    period: raw.nr,
    weeks: raw.weeks ?? [],
    subjectId: raw.subject?.id,
    subject: raw.subject?.name,
    subjectShort: raw.subject?.local_id,
    // The Kurs ("11MA1"), which the school's Klausur plan names.
    groupLocalId: raw.group?.local_id,
    ...roomsAndTeachers(raw),
    from: raw.time?.from,
    to: raw.time?.to,
  };
}

/**
 * Klassenbuch notes hanging off a lesson. Four types exist, verified against
 * the live API: KLA (Klassenarbeit/Klausur), LEI (Leistungskontrolle), HAU
 * (Hausaufgabe) and STU (Stundenthema, which is backward-looking and filtered
 * out by the data layer). KLA and LEI are what the Termine screen shows;
 * teachers enter them months ahead, so they reach much further into the
 * future than the other two.
 */
export function mapJournalNotes(rawLesson) {
  const date = rawLesson.day?.date;
  return (rawLesson.notes ?? []).map((note) => ({
    id: note.id,
    date,
    period: rawLesson.nr,
    subject: rawLesson.subject?.name,
    subjectShort: rawLesson.subject?.local_id,
    subjectId: rawLesson.subject?.id,
    text: note.description ?? "",
    typeName: note.type?.name,
    typeCode: note.type?.local_id,
    teacher: joined(localIds(rawLesson.teachers)),
  }));
}

export function mapAbsence(raw) {
  return {
    id: raw.id,
    from: pick(raw, "from", "date"),
    to: pick(raw, "to") ?? pick(raw, "from", "date"),
    excused: raw.excused ?? null,
    type: raw.type?.name ?? raw.type,
  };
}

/**
 * An announcement has no created_at: `read_from`/`read_to` (the visibility
 * window) are its only dates, so `read_from` stands in for the publish date.
 * There's no read flag either — the read counts (from
 * include=readGuardiansCount,readStudentsCount) are scoped to the viewer,
 * so a count above zero means "this account has read it". The author only
 * exists with include=teacher.
 */
export function mapAnnouncement(raw) {
  return {
    id: raw.id,
    title: raw.title ?? "",
    body: raw.message ?? "",
    date: raw.read_from,
    visibleUntil: raw.read_to,
    type: raw.type?.name,
    author: personName(raw.teacher) ?? null,
    // Kept apart, not summed: a letter asks one role to confirm, and summing
    // marks it read as soon as the other side opens it.
    needsGuardianConfirmation: Boolean(raw.need_confirmation_from_guardian),
    needsStudentConfirmation: Boolean(raw.need_confirmation_from_student),
    readByGuardian: (raw.read_guardians_count ?? 0) > 0,
    readByStudent: (raw.read_students_count ?? 0) > 0,
  };
}

/** `/api/me` reduced to the role. The rest is e-mail, phone numbers and birthdays. */
export function mapMe(raw) {
  return { role: raw?.role ?? null };
}
