// The Fach detail page: grouping by type, and acknowledging a new or changed grade.
import assert from "node:assert/strict";
import { afterEach, describe, mock, test } from "node:test";
import { acknowledgeGrade, gradeNotice, groupByType } from "../../public/js/data/fach-detail.js";

function grade(type, numeric, givenAt, weighting = 1) {
  return { numeric, givenAt, collection: { type, weighting, name: `${type} ${givenAt}` } };
}

describe("groupByType", () => {
  test("merges each teacher's spelling into one group", () => {
    const groups = groupByType([grade("SO", 12, "2026-09-11"), grade("so", 14, "2026-09-23")]);
    assert.deepEqual(
      groups.map((g) => [g.type, g.grades.length]),
      [["Sonstige", 2]]
    );
  });

  test("puts Klausur first even when another type weighs more", () => {
    const groups = groupByType([
      grade("So", 13, "2026-09-11"),
      grade("So", 14, "2026-09-23"),
      grade("LK", 11, "2026-09-26"),
      grade("K", 13, "2026-10-09"),
    ]);
    assert.deepEqual(
      groups.map((g) => g.type),
      ["Klausur", "Sonstige", "Leistungskontrolle"]
    );
  });

  test("orders the other types by weighting share", () => {
    const groups = groupByType([
      grade("LK", 11, "2026-09-26"),
      grade("SO", 12, "2026-09-11"),
      grade("SO", 10, "2026-10-01"),
    ]);
    assert.deepEqual(
      groups.map((g) => [g.type, g.weightingPct]),
      [
        ["Sonstige", 67],
        ["Leistungskontrolle", 33],
      ]
    );
  });

  test("gives Klausuren half the Oberstufe weight", () => {
    const groups = groupByType(
      [grade("K", 13, "2026-10-09"), grade("SO", 13, "2026-11-17"), grade("So", 14, "2026-09-23"), grade("LK", 13, "2026-09-11")],
      "points_0_15"
    );
    assert.deepEqual(
      groups.map((g) => [g.type, g.weightingPct]),
      [
        ["Klausur", 50],
        ["Sonstige", 33],
        ["Leistungskontrolle", 17],
      ]
    );
  });

  test("lists a group's grades newest first", () => {
    const [group] = groupByType([grade("KL", 10, "2026-09-15"), grade("Klausur", 8, "2026-11-03")]);
    assert.deepEqual(
      group.grades.map((g) => g.givenAt),
      ["2026-11-03", "2026-09-15"]
    );
  });
});

describe("gradeNotice", () => {
  const entry = (overrides) => ({
    id: "n-1",
    type: "grade",
    action: "created",
    createdAt: "2026-10-02",
    unread: false,
    gradeId: 70482217,
    ...overrides,
  });
  const newGrade = { id: 70482217, isNew: true, isChanged: false };
  const changedGrade = { id: 70482217, isNew: true, isChanged: true };

  test("dates a new grade by its creation entry", () => {
    const notice = gradeNotice(newGrade, [entry({ unread: true })]);
    assert.deepEqual(notice, { label: "Eingetragen", date: "2026-10-02", unreadIds: ["n-1"] });
  });

  test("gives a changed grade no date: the update entry's date isn't when it changed", () => {
    // Real data: the update entry is dated 19.10., the change came after a read on 08.11.
    const notice = gradeNotice(changedGrade, [
      entry({ id: "n-1", createdAt: "2026-10-02" }),
      entry({ id: "n-2", action: "updated", createdAt: "2026-10-19", unread: true }),
    ]);
    assert.equal(notice.label, "Geändert");
    assert.equal(notice.date, null);
    assert.deepEqual(notice.unreadIds, ["n-2"]);
  });

  test("collects every unread entry of the grade, and only those", () => {
    const notice = gradeNotice(changedGrade, [
      entry({ id: "n-1", unread: true }),
      entry({ id: "n-2", action: "updated", unread: true }),
      entry({ id: "n-3", unread: true, gradeId: 1 }),
      entry({ id: "n-4", type: "announcement", gradeId: null, unread: true }),
    ]);
    assert.deepEqual(notice.unreadIds, ["n-1", "n-2"]);
  });

  test("has no date when the feed doesn't know the grade", () => {
    assert.deepEqual(gradeNotice(newGrade, []), { label: "Eingetragen", date: null, unreadIds: [] });
  });

  test("is null for a seen grade", () => {
    assert.equal(gradeNotice({ id: 70482217, isNew: false, isChanged: false }, [entry({})]), null);
  });
});

describe("acknowledgeGrade", () => {
  function stubApi({ failGrade = false, failNotification = false } = {}) {
    const calls = [];
    mock.method(globalThis, "fetch", async (url, init = {}) => {
      const path = new URL(url).pathname;
      calls.push(`${init.method ?? "GET"} ${path}`);
      const fails = (failGrade && path.startsWith("/api/grades/")) || (failNotification && path.startsWith("/api/notifications/"));
      if (fails) return { ok: false, status: 404, text: async () => "{}" };
      return { ok: true, status: 200, text: async () => "{}" };
    });
    return calls;
  }

  afterEach(() => mock.restoreAll());

  test("confirms the grade, then marks its notifications read", async () => {
    const calls = stubApi();
    await acknowledgeGrade(70482217, ["n-1", "n-2"]);
    assert.deepEqual(calls, [
      "POST /api/grades/70482217/read",
      "POST /api/notifications/n-1/read",
      "POST /api/notifications/n-2/read",
    ]);
  });

  test("fails when the grade can't be confirmed, without touching notifications", async () => {
    const calls = stubApi({ failGrade: true });
    await assert.rejects(acknowledgeGrade(70482217, ["n-1"]));
    assert.deepEqual(calls, ["POST /api/grades/70482217/read"]);
  });

  test("still succeeds when a notification can't be marked", async () => {
    stubApi({ failNotification: true });
    await acknowledgeGrade(70482217, ["n-1"]);
  });
});
