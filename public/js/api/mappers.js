// Raw beste.schule API JSON -> flat domain objects. Verified against the live
// API (2026-09); the quirks are in docs/api-notes.md. The ones shaping this file:
//   - `name` on a person is the surname; `forename` is the first name
//   - `rooms`/`teachers` are arrays, labelled by `local_id`
//   - grades get their subject via `collection.subject`
//   - interval `type` ("Sek I" | "11er" | "12er") decides the grading scale

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
 * Room and teacher fields for timetable and plan lessons. The lists are kept
 * because a changed lesson holds old and new entries in one array; telling
 * them apart is a set difference against the timetable.
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
 * "Sek I" → Noten 1-6, "11er"/"12er" → Punkte 0-15.
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

/** Course groups. meta === 1 is the Klasse/Tutorenkurs, not a taught course. */
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
 * The API has no LK/GK field, so this uses the school's naming: uppercase
 * subject code = LK ("11MA1"), lowercase = GK ("11ph2"). Only a hint —
 * resolveCourseTypes() discards it when it looks wrong.
 */
export function looksLikeLeistungskurs(group) {
  const code = String(group.localId ?? "").replace(/^[0-9-]+/, "").replace(/[0-9]+$/, "");
  return code.length > 0 && code === code.toUpperCase() && /[A-ZÄÖÜ]/.test(code);
}

export function mapGradeCollection(raw) {
  return {
    id: raw.id,
    // School-configured label: "Sonstige", "Klausur", ...
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
 * One lesson from substitution-plans/days. What exactly changed needs the
 * timetable; js/data/ works that out.
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
    // The Kurs ("11MA1"); the Klausur plan refers to it.
    groupLocalId: raw.group?.local_id,
    ...roomsAndTeachers(raw),
    from: raw.time?.from,
    to: raw.time?.to,
  };
}

/**
 * Klassenbuch notes of a lesson: KLA (Klausur), LEI (Leistungskontrolle),
 * HAU (Hausaufgabe), STU (Stundenthema, dropped by the data layer).
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
 * No created_at: `read_from` stands in for the publish date. No read flag
 * either: the read counts are scoped to the viewer, so > 0 means "read".
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
    // Not summed: a letter asks one role to confirm.
    needsGuardianConfirmation: Boolean(raw.need_confirmation_from_guardian),
    needsStudentConfirmation: Boolean(raw.need_confirmation_from_student),
    readByGuardian: (raw.read_guardians_count ?? 0) > 0,
    readByStudent: (raw.read_students_count ?? 0) > 0,
  };
}

/** `/api/me` reduced to the role; the rest is personal data. */
export function mapMe(raw) {
  return { role: raw?.role ?? null };
}
