// Raw beste.schule API JSON -> the normalized domain shapes from docs/plan.md §3.
//
// ASSUMPTIONS TO VERIFY once docs/api-notes.md exists (task: "Run discovery
// against live API once token is added"). These field names are the most
// plausible reading of docs/plan.md §1/§2 (Laravel resource conventions,
// German domain terms) but are NOT yet confirmed against a real response:
//   - person fields: firstname/lastname (not first_name/last_name)
//   - grade: { id, value, given_at, subject_id, collection_id, collection: {...} }
//   - collection: { id, type, name, weighting, interval_id }
//   - subject: { id, name, short_name, course_type ('LK'|'GK'), teacher }
//   - lesson (timetable): { day_of_week or date, period/lesson, start, end, subject, room }
//   - substitution: { date, lesson/period, subject, room_from, room_to, teacher_from,
//     teacher_to, type ('cancelled'|'room_change'|'substitution'), note }
//   - homework/journal note: { id, date, subject, type, text/content, due_date }
// Adjust the `pick`/mapping calls below once docs/api-notes.md pins these down —
// keep the mapping logic (grouping, merging, sorting) as-is where possible.

import { parseGrade } from "../domain/grades.js";

function pick(obj, ...keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

export function mapStudent(raw) {
  return {
    id: raw.id,
    firstName: pick(raw, "firstname", "first_name") ?? "",
    lastName: pick(raw, "lastname", "last_name") ?? "",
    schoolName: raw.school?.name ?? pick(raw, "school_name") ?? "",
    groups: (raw.groups ?? []).map((g) => ({ id: g.id, name: g.name })),
  };
}

export function mapYear(raw) {
  return {
    id: raw.id,
    name: raw.name,
    from: pick(raw, "from", "begin", "start_date"),
    to: pick(raw, "to", "end", "end_date"),
  };
}

export function mapInterval(raw) {
  return {
    id: raw.id,
    name: raw.name,
    from: pick(raw, "from", "begin", "start_date"),
    to: pick(raw, "to", "end", "end_date"),
    yearId: pick(raw, "year_id"),
  };
}

/**
 * Decides Sek I vs. Oberstufe for a subject/course. Heuristic until
 * docs/api-notes.md confirms how beste.schule actually marks this
 * (course_type field vs. group/Jahrgang naming vs. something else).
 */
export function resolveCourseType(rawSubjectOrGroup) {
  const explicit = pick(rawSubjectOrGroup, "course_type", "courseType");
  if (explicit === "LK" || explicit === "GK") return explicit;
  return null;
}

export function mapSubject(raw) {
  return {
    id: raw.id,
    name: raw.name,
    short: pick(raw, "short_name", "short", "abbreviation"),
    teacher: raw.teacher?.name ?? pick(raw, "teacher_name"),
    courseType: resolveCourseType(raw),
  };
}

export function mapGradeCollection(raw) {
  return {
    id: raw.id,
    type: pick(raw, "type", "collection_type") ?? "unknown",
    name: raw.name,
    weighting: Number(pick(raw, "weighting", "weight") ?? 1),
    intervalId: pick(raw, "interval_id"),
  };
}

/**
 * @param {object} raw
 * @param {import('../domain/grades.js').GradeScale} scale
 */
export function mapGrade(raw, scale) {
  const collectionRaw = raw.collection ?? {};
  const rawValue = String(pick(raw, "value", "grade") ?? "");
  return {
    id: raw.id,
    ...parseGrade(rawValue, scale),
    subjectId: pick(raw, "subject_id") ?? raw.subject?.id,
    collection: mapGradeCollection(collectionRaw),
    givenAt: pick(raw, "given_at", "date", "created_at"),
    teacher: raw.teacher?.name,
  };
}

const SUBSTITUTION_STATUS = {
  cancelled: "cancelled",
  entfall: "cancelled",
  room_change: "room_change",
  substitution: "substitution",
  vertretung: "substitution",
};

/**
 * Merges a day's regular timetable lessons with that day's substitution-plan
 * entries into a single ordered list with a `status` per design requirement
 * (states distinguishable without color: regular / room_change / substitution / cancelled).
 */
export function mergeLessonsWithSubstitutions(regularLessons, substitutions) {
  const byPeriod = new Map();
  for (const lesson of regularLessons) {
    const period = pick(lesson, "period", "lesson") ?? lesson.hour;
    byPeriod.set(period, {
      period,
      start: lesson.start ?? lesson.times?.start,
      end: lesson.end ?? lesson.times?.end,
      subject: lesson.subject?.name ?? lesson.subject_name,
      room: lesson.room?.name ?? lesson.room_name,
      teacher: lesson.teacher?.name,
      status: "regular",
    });
  }

  for (const sub of substitutions) {
    const period = pick(sub, "period", "lesson") ?? sub.hour;
    const existing = byPeriod.get(period) ?? { period };
    const rawType = String(pick(sub, "type", "status") ?? "").toLowerCase();
    const status = SUBSTITUTION_STATUS[rawType] ?? (sub.room_to ? "room_change" : "substitution");

    byPeriod.set(period, {
      ...existing,
      subject: sub.subject?.name ?? existing.subject,
      room: sub.room_to?.name ?? sub.room?.name ?? existing.room,
      previousRoom: sub.room_from?.name ?? (status === "room_change" ? existing.room : undefined),
      teacher: sub.teacher_to?.name ?? existing.teacher,
      note: sub.note,
      status,
    });
  }

  return [...byPeriod.values()].sort((a, b) => Number(a.period) - Number(b.period));
}

export function mapHomework(raw) {
  return {
    id: raw.id,
    lessonDate: pick(raw, "date", "lesson_date"),
    subject: raw.subject?.name ?? pick(raw, "subject_name"),
    text: pick(raw, "text", "content", "homework") ?? "",
    due: pick(raw, "due_date", "due"),
  };
}

export function mapAbsence(raw) {
  return {
    id: raw.id,
    from: pick(raw, "from", "date"),
    to: pick(raw, "to") ?? pick(raw, "from", "date"),
    excused: raw.excused ?? null,
    type: raw.type,
  };
}

export function mapAnnouncement(raw) {
  return {
    id: raw.id,
    title: raw.title ?? "",
    body: pick(raw, "body", "text", "content") ?? "",
    createdAt: pick(raw, "created_at", "date"),
    read: Boolean(pick(raw, "read", "is_read")),
  };
}
