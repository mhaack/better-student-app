// The Noten screen's data and the Noten tab's dot.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { clearCache } from "../../public/js/data/cache.js";
import { chartSelection, getNotenData, hasNewGrades } from "../../public/js/data/noten.js";

const STUDENT = 7;
const CONTEXT = {
  year: { id: 3 },
  interval: { id: 33 },
  scale: "grade_1_6",
  courses: [{ subjectId: 5, name: "Biologie" }],
};

// Raw grades as /api/grades returns them (ids and names invented).
const rawGrade = (id, subjectId, read, readByType = null) => ({
  id,
  value: "2",
  read,
  read_by_type: readByType,
  collection: { id, name: "Test", subject_id: subjectId, subject: { id: subjectId, name: "Fach" } },
});

/** A valued grade in a collection of the given type, as /api/grades returns it. */
const valuedGrade = (id, subjectId, value, type) => ({
  ...rawGrade(id, subjectId, true, "guardian"),
  value,
  collection: { id, name: "Test", type, subject_id: subjectId, subject: { id: subjectId, name: "Fach" } },
});

/** Answers /api/grades, /api/finalgrades (none) and /api/me; records the paths asked for. */
function stubApi(grades, role = "guardian") {
  const paths = [];
  mock.method(globalThis, "fetch", async (url) => {
    const { pathname, searchParams } = new URL(url);
    paths.push(pathname);
    if (pathname === "/api/grades") {
      assert.equal(searchParams.get("filter[interval]"), "33");
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: grades }) };
    }
    if (pathname === "/api/finalgrades") return { ok: true, status: 200, text: async () => JSON.stringify({ data: [] }) };
    if (pathname === "/api/me") return { ok: true, status: 200, text: async () => JSON.stringify({ data: { role } }) };
    return { ok: false, status: 404, text: async () => "{}" };
  });
  return paths;
}

beforeEach(() => clearCache());
afterEach(() => mock.restoreAll());

describe("hasNewGrades", () => {
  test("is true for a grade the guardian hasn't seen, although the child has", async () => {
    stubApi([rawGrade(1, 5, true, "student")]);
    assert.equal(await hasNewGrades(STUDENT, CONTEXT), true);
  });

  test("is false once every grade is seen", async () => {
    stubApi([rawGrade(1, 5, true, "guardian")]);
    assert.equal(await hasNewGrades(STUDENT, CONTEXT), false);
  });

  test("ignores a new grade in a subject that isn't one of the student's courses", async () => {
    stubApi([rawGrade(1, 99, false)]);
    assert.equal(await hasNewGrades(STUDENT, CONTEXT), false);
  });

  test("asks only for grades and role, not the Endnoten", async () => {
    const paths = stubApi([rawGrade(1, 5, false)]);
    await hasNewGrades(STUDENT, CONTEXT);
    assert.deepEqual([...new Set(paths)].sort(), ["/api/grades", "/api/me"]);
  });
});

describe("getNotenData", () => {
  const options = (scale, courses) => ({ yearId: 3, intervalId: 33, scale, courses });
  const COURSES = [
    { subjectId: 5, name: "Biologie" },
    { subjectId: 6, name: "Mathematik" },
    { subjectId: 7, name: "Geschichte" },
  ];

  test("lists each counted grade for the charts as a whole Note with its kind", async () => {
    stubApi([valuedGrade(1, 5, "2+", "KA"), valuedGrade(2, 5, "2-", "SO"), valuedGrade(3, 6, "4", "LK")]);
    const { chart } = await getNotenData(STUDENT, options("grade_1_6", COURSES));
    assert.deepEqual(chart.entries, [
      { subjectId: 5, value: 2, kind: "ka" },
      { subjectId: 5, value: 2, kind: "sl" },
      { subjectId: 6, value: 4, kind: "sl" },
    ]);
  });

  test("keeps Oberstufe grades as points", async () => {
    stubApi([valuedGrade(1, 5, "13", "Klausur"), valuedGrade(2, 5, "0", "SO")]);
    const { chart } = await getNotenData(STUDENT, options("points_0_15", COURSES));
    assert.deepEqual(
      chart.entries.map((e) => [e.value, e.kind]),
      [
        [13, "ka"],
        [0, "sl"],
      ]
    );
  });

  test("leaves out grades without a value and grades outside the student's courses", async () => {
    stubApi([valuedGrade(1, 5, "", "SO"), valuedGrade(2, 5, "fehlt", "SO"), valuedGrade(3, 99, "1", "SO")]);
    const { chart } = await getNotenData(STUDENT, options("grade_1_6", COURSES));
    assert.deepEqual(chart.entries, []);
  });

  test("counts Leistungskurse twice in the Oberstufe overall average", async () => {
    stubApi([valuedGrade(1, 5, "13", "SO"), valuedGrade(2, 6, "8", "SO")]);
    const courses = [
      { subjectId: 5, name: "Biologie", courseType: "LK" },
      { subjectId: 6, name: "Mathematik", courseType: "GK" },
    ];
    const { overallAverage } = await getNotenData(STUDENT, options("points_0_15", courses));
    assert.ok(Math.abs(overallAverage.value - 11.3333) < 1e-3, `expected ~11.3333, got ${overallAverage.value}`);
  });

  test("counts every subject once in the Sek I overall average", async () => {
    stubApi([valuedGrade(1, 5, "1", "SO"), valuedGrade(2, 6, "4", "SO")]);
    const courses = [
      { subjectId: 5, name: "Biologie", courseType: "LK" },
      { subjectId: 6, name: "Mathematik", courseType: "GK" },
    ];
    const { overallAverage } = await getNotenData(STUDENT, options("grade_1_6", courses));
    assert.equal(overallAverage.value, 2.5);
  });

  test("counts each course's grades alphabetically, including courses without any", async () => {
    stubApi([valuedGrade(1, 6, "1", "SO"), valuedGrade(2, 5, "3", "SO"), valuedGrade(3, 6, "2", "KL")]);
    const { chart } = await getNotenData(STUDENT, options("grade_1_6", COURSES));
    assert.deepEqual(
      chart.subjects.map((s) => [s.name, s.count]),
      [
        ["Biologie", 1],
        ["Geschichte", 0],
        ["Mathematik", 2],
      ]
    );
  });

  test("lists Oberstufe Leistungskurse first for the subject filter", async () => {
    stubApi([]);
    const courses = [
      { subjectId: 5, name: "Biologie", courseType: "GK" },
      { subjectId: 6, name: "Mathematik", courseType: "LK" },
      { subjectId: 7, name: "Chemie", courseType: "GK" },
      { subjectId: 8, name: "Englisch", courseType: "LK" },
    ];
    const { chart } = await getNotenData(STUDENT, options("points_0_15", courses));
    assert.deepEqual(
      chart.subjects.map((s) => s.name),
      ["Englisch", "Mathematik", "Biologie", "Chemie"]
    );
  });
});

describe("chartSelection", () => {
  const DATA = {
    chart: {
      entries: [
        { subjectId: 5, value: 13, kind: "ka" },
        { subjectId: 5, value: 9, kind: "sl" },
        { subjectId: 6, value: 4, kind: "sl" },
      ],
    },
  };

  test("takes every subject when nothing is selected", () => {
    const { dist, subjectCount } = chartSelection(DATA, { scale: "points_0_15", unit: "points", selected: null });
    assert.equal(dist.count, 3);
    assert.equal(subjectCount, 2);
  });

  test("keeps only the selected subjects' grades", () => {
    const { dist, subjectCount } = chartSelection(DATA, { scale: "points_0_15", unit: "points", selected: new Set([6]) });
    assert.equal(dist.count, 1);
    assert.equal(subjectCount, 1);
  });

  test("converts Oberstufe points to Noten when asked", () => {
    const { dist } = chartSelection(DATA, { scale: "points_0_15", unit: "notes", selected: null });
    assert.deepEqual(
      dist.buckets.map((b) => b.total),
      [1, 0, 1, 1, 0, 0]
    );
  });

  test("is empty for a selection without grades", () => {
    const { dist, subjectCount } = chartSelection(DATA, { scale: "points_0_15", unit: "points", selected: new Set([7]) });
    assert.equal(dist.count, 0);
    assert.equal(subjectCount, 0);
  });
});
