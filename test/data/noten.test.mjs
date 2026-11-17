// The Noten tab's dot: an unseen grade in one of the student's courses, this Halbjahr.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { clearCache } from "../../public/js/data/cache.js";
import { hasNewGrades } from "../../public/js/data/noten.js";

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

/** Answers /api/grades and /api/me; records the paths asked for. */
function stubApi(grades, role = "guardian") {
  const paths = [];
  mock.method(globalThis, "fetch", async (url) => {
    const { pathname, searchParams } = new URL(url);
    paths.push(pathname);
    if (pathname === "/api/grades") {
      assert.equal(searchParams.get("filter[interval]"), "33");
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: grades }) };
    }
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
