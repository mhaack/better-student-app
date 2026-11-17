// The repository's write calls: what they send and which cache they clear.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { clearCache } from "../../public/js/data/cache.js";
import {
  fetchGrades,
  fetchNotifications,
  markGradeRead,
  markNotificationRead,
} from "../../public/js/data/repository.js";

const FEED = [
  {
    id: "9611ee97-e230-4baa-a87f-d7ffe873a34b",
    notification_type: "grade",
    action: "updated",
    created_at: "2026-10-19",
    read_at: null,
    grade: { id: 70482217, student_id: 7, collection: { subject_id: 68 } },
    data: { subject_name: "Geschichte", collection_name: "History Flash mdl." },
  },
];

/** Records every request; GETs return the feed, POSTs return a body with personal data. */
function stubApi() {
  const calls = [];
  mock.method(globalThis, "fetch", async (url, init = {}) => {
    calls.push({ path: new URL(url).pathname, method: init.method ?? "GET" });
    const body = init.method === "POST" ? { data: { notifiable: { email: "eltern@example.invalid" } } } : { data: FEED };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  });
  return calls;
}

beforeEach(() => clearCache());
afterEach(() => mock.restoreAll());

describe("markNotificationRead", () => {
  test("posts to the entry's read route", async () => {
    const calls = stubApi();
    await markNotificationRead("9611ee97-e230-4baa-a87f-d7ffe873a34b");
    assert.deepEqual(calls, [
      { path: "/api/notifications/9611ee97-e230-4baa-a87f-d7ffe873a34b/read", method: "POST" },
    ]);
  });

  test("makes the next feed read hit the API again", async () => {
    const calls = stubApi();
    await fetchNotifications();
    await markNotificationRead("9611ee97-e230-4baa-a87f-d7ffe873a34b");
    await fetchNotifications();
    assert.equal(calls.filter((c) => c.method === "GET").length, 2);
  });

  test("returns nothing from the response", async () => {
    stubApi();
    assert.equal(await markNotificationRead("9611ee97-e230-4baa-a87f-d7ffe873a34b"), undefined);
  });
});

describe("markGradeRead", () => {
  test("posts to the grade's read route", async () => {
    const calls = stubApi();
    await markGradeRead(70482217);
    assert.deepEqual(calls, [{ path: "/api/grades/70482217/read", method: "POST" }]);
  });

  test("makes the next grades read hit the API again", async () => {
    const calls = stubApi();
    await fetchGrades(7, { scale: "points_0_15" });
    await markGradeRead(70482217);
    await fetchGrades(7, { scale: "points_0_15" });
    assert.equal(calls.filter((c) => c.method === "GET" && c.path === "/api/grades").length, 2);
  });
});
