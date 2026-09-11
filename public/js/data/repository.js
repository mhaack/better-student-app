// Cached wrappers around the beste.schule routes this app uses.
// Screen-level aggregation lives in heute.js / noten.js / fach-detail.js.
//
// Every query param here has been probed against the live API (2026-09) —
// filter[student], filter[year], filter[interval], filter[subject] and
// filter[range] all validate; `include` values are the ones the API's
// allowlist actually accepts.
import { apiFetch, apiFetchAll } from "../api/client.js";
import { cached } from "./cache.js";
import {
  mapStudent,
  mapYear,
  mapGroup,
  mapGrade,
  mapPlanLesson,
  mapTimetableLesson,
  mapJournalNotes,
  mapAnnouncement,
} from "../api/mappers.js";

export async function fetchStudents() {
  return cached("students", async () => {
    const res = await apiFetch("students");
    const list = Array.isArray(res?.data) ? res.data : [res?.data].filter(Boolean);
    return list.map(mapStudent);
  });
}

export async function fetchSchool() {
  return cached("school", () => apiFetch("school").then((r) => r?.data ?? null), {
    staleMs: 60 * 60_000,
  });
}

/** Years come with their intervals nested, so there's no separate intervals call. */
export async function fetchYears() {
  return cached("years", async () => {
    const list = await apiFetchAll("years");
    return list.map(mapYear);
  });
}

/**
 * The student's course groups — this is how we learn which subjects they
 * actually take. /api/subjects returns every subject the school offers.
 */
export async function fetchGroups(studentId) {
  return cached(`groups:${studentId}`, async () => {
    const list = await apiFetchAll("groups", {
      params: { "filter[student]": studentId, include: "subjects" },
    });
    return list.map(mapGroup);
  });
}

/**
 * @param {number} studentId
 * @param {{ yearId?: number, intervalId?: number, scale: import('../domain/grades.js').GradeScale }} options
 */
export async function fetchGrades(studentId, options) {
  const { yearId, intervalId, scale } = options;
  return cached(`grades:${studentId}:${yearId ?? ""}:${intervalId ?? ""}:${scale}`, async () => {
    const list = await apiFetchAll("grades", {
      params: {
        "filter[student]": studentId,
        ...(yearId ? { "filter[year]": yearId } : {}),
        ...(intervalId ? { "filter[interval]": intervalId } : {}),
        // `subject` is not an allowed include here; it hangs off the collection.
        include: "collection.subject,teacher",
      },
    });
    return list.map((raw) => mapGrade(raw, scale));
  });
}

/**
 * Endnoten. For schools that let the system compute them these carry a value
 * or a calculation_rule; where the teacher decides (calculation_for:
 * "teacher") they carry neither, and subject averages stay our own estimate.
 * The detail route returns the same fields as the list, so there's no
 * per-id follow-up call.
 */
export async function fetchFinalgrades(studentId, { yearId } = {}) {
  return cached(`finalgrades:${studentId}:${yearId ?? ""}`, async () =>
    apiFetchAll("finalgrades", {
      params: {
        "filter[student]": studentId,
        ...(yearId ? { "filter[year]": yearId } : {}),
      },
    })
  );
}

/**
 * The published day plan: every lesson of the day with its status
 * ("initial" / "planned" / "canceled"), not just the changes.
 */
export async function fetchDayPlans(fromIso, toIso) {
  return cached(
    `dayplans:${fromIso}:${toIso}`,
    async () => {
      const days = await apiFetchAll("substitution-plans/days", {
        params: {
          "filter[range]": `${fromIso},${toIso}`,
          include: "lessons,subject,teachers,rooms,notes",
        },
      });
      return days.map((day) => ({
        date: day.date,
        notes: (day.notes ?? []).filter(Boolean),
        lessons: (day.lessons ?? []).map(mapPlanLesson).sort((a, b) => a.period - b.period),
      }));
    },
    { staleMs: 60_000 }
  );
}

export async function fetchCurrentTimetable() {
  return cached(
    "timetable:current",
    async () => {
      const res = await apiFetch("time-tables/current", { params: { include: "lessons.times" } });
      const data = res?.data ?? {};
      return {
        validFrom: data.valid_from,
        validTo: data.valid_to,
        // Maps ISO calendar weeks to A/B week types for alternating lessons.
        weeks: data.weeks ?? [],
        noSchoolDates: data.no_school_dates ?? [],
        lessons: (data.lessons ?? []).map(mapTimetableLesson),
      };
    },
    { staleMs: 60 * 60_000 }
  );
}

/** Klassenbuch entries — announced tests, homework, lesson topics. */
export async function fetchJournalNotes(studentId, fromIso, toIso) {
  return cached(`journal:${studentId}:${fromIso}:${toIso}`, async () => {
    const lessons = await apiFetchAll("journal/lessons", {
      params: {
        "filter[student]": studentId,
        "filter[range]": `${fromIso},${toIso}`,
        include: "notes.type",
      },
    });
    return lessons.flatMap(mapJournalNotes);
  });
}

export async function fetchAnnouncements() {
  return cached("announcements", async () => {
    const list = await apiFetchAll("announcements");
    return list.map(mapAnnouncement);
  });
}

export function isoDate(date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}
