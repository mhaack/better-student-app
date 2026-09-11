// Thin, cached wrappers around apiFetch for the routes in docs/plan.md §2.
// Aggregation for specific screens lives in heute.js / noten.js / fach-detail.js.
import { apiFetch, apiFetchAll } from "../api/client.js";
import { cached } from "./cache.js";
import {
  mapStudent,
  mapYear,
  mapInterval,
  mapSubject,
  mapGrade,
  mapHomework,
  mapAnnouncement,
} from "../api/mappers.js";

export async function fetchStudents() {
  return cached("students", async () => {
    const res = await apiFetch("students");
    const list = Array.isArray(res?.data) ? res.data : [res?.data].filter(Boolean);
    return list.map(mapStudent);
  });
}

export async function fetchYears() {
  return cached("years", async () => {
    const list = await apiFetchAll("years");
    return list.map(mapYear);
  });
}

export async function fetchIntervals(yearId) {
  return cached(`intervals:${yearId}`, async () => {
    const list = await apiFetchAll("intervals", { params: { "filter[year]": yearId } });
    return list.map(mapInterval);
  });
}

export async function fetchSubjects(studentId) {
  return cached(`subjects:${studentId}`, async () => {
    const list = await apiFetchAll("subjects", { params: { "filter[student]": studentId } });
    return list.map(mapSubject);
  });
}

/**
 * @param {number} studentId
 * @param {{ yearId?: number, intervalId?: number, scale: import('../domain/grades.js').GradeScale }} options
 */
export async function fetchGrades(studentId, options) {
  const { yearId, intervalId, scale } = options;
  return cached(`grades:${studentId}:${yearId ?? ""}:${intervalId ?? ""}`, async () => {
    const list = await apiFetchAll("grades", {
      params: {
        "filter[student]": studentId,
        ...(yearId ? { "filter[year]": yearId } : {}),
        ...(intervalId ? { "filter[interval]": intervalId } : {}),
        include: "collection,subject,teacher",
      },
    });
    return list.map((raw) => mapGrade(raw, scale));
  });
}

export async function fetchFinalgrades(studentId, { yearId } = {}) {
  return cached(`finalgrades:${studentId}:${yearId ?? ""}`, async () => {
    return apiFetchAll("finalgrades", {
      params: {
        "filter[student]": studentId,
        ...(yearId ? { "filter[year]": yearId } : {}),
      },
    });
  });
}

export async function fetchFinalgradeDetail(id) {
  return cached(`finalgrade:${id}`, () => apiFetch(`finalgrades/${id}`).then((r) => r?.data ?? null));
}

export async function fetchCurrentTimetable() {
  return cached(
    "timetable:current",
    () => apiFetch("time-tables/current", { params: { include: "lessons.times" } }),
    { staleMs: 5 * 60_000 }
  );
}

export async function fetchSubstitutions(fromIso, toIso) {
  return cached(
    `substitutions:${fromIso}:${toIso}`,
    () =>
      apiFetchAll("substitution-plans/lessons", {
        params: {
          "filter[range]": `${fromIso},${toIso}`,
          include: "lessons,subject,teachers,rooms,notes",
        },
      }),
    { staleMs: 60_000 }
  );
}

export async function fetchHomework(studentId, fromIso, toIso) {
  return cached(`homework:${studentId}:${fromIso}:${toIso}`, async () => {
    const list = await apiFetchAll("journal/lessons", {
      params: {
        "filter[student]": studentId,
        "filter[range]": `${fromIso},${toIso}`,
        include: "notes.type",
      },
    });
    return list.map(mapHomework);
  });
}

export async function fetchAnnouncements() {
  return cached("announcements", async () => {
    const list = await apiFetchAll("announcements");
    return list.map(mapAnnouncement);
  });
}

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
