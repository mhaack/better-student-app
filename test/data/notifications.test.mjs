// Preparing the bell feed: which entries show, one per grade, joins, order.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { prepareNotifications } from "../../public/js/data/notifications.js";

const STUDENT = 7;

function gradeEntry(overrides = {}) {
  return {
    id: 1,
    type: "grade",
    action: "created",
    createdAt: "2026-11-10T08:00:00.000000Z",
    unread: true,
    gradeId: 100,
    studentId: STUDENT,
    subjectId: 5,
    subjectName: "Mathematik",
    collectionName: "Klassenarbeit 1",
    announcementId: null,
    title: null,
    ...overrides,
  };
}

function infoEntry(overrides = {}) {
  return gradeEntry({
    id: 50,
    type: "announcement",
    action: "created",
    gradeId: null,
    studentId: null,
    subjectId: null,
    subjectName: null,
    collectionName: null,
    announcementId: 9,
    title: "Wandertag",
    ...overrides,
  });
}

const prepare = (entries, extra = {}) =>
  prepareNotifications(entries, { grades: [], announcements: [], studentId: STUDENT, ...extra });

describe("prepareNotifications", () => {
  test("drops grade entries of other students, keeps announcements", () => {
    const { unread } = prepare([
      gradeEntry({ id: 1, studentId: 8 }),
      gradeEntry({ id: 2, gradeId: 101 }),
      infoEntry({ id: 3, studentId: 8 }),
    ]);
    assert.deepEqual(unread.map((i) => i.id).sort(), [2, 3]);
  });

  test("drops other notification types", () => {
    const { unread, read } = prepare([gradeEntry({ type: "message" }), gradeEntry({ id: 2 })]);
    assert.equal(unread.length + read.length, 1);
  });

  test("keeps the newest created entry of a grade", () => {
    const { unread } = prepare([
      gradeEntry({ id: 1, createdAt: "2026-11-01T08:00:00Z" }),
      gradeEntry({ id: 2, createdAt: "2026-11-02T08:00:00Z" }),
    ]);
    assert.deepEqual(unread.map((i) => i.id), [2]);
  });

  test("an updated entry wins over a created one even when older", () => {
    const { read, unread } = prepare([
      gradeEntry({ id: 1, action: "created", createdAt: "2026-11-05T08:00:00Z", unread: true }),
      gradeEntry({ id: 2, action: "updated", createdAt: "2026-11-02T08:00:00Z", unread: false }),
    ]);
    assert.equal(unread.length, 0);
    assert.equal(read.length, 1);
    assert.equal(read[0].kind, "changed");
    assert.equal(read[0].unread, false);
  });

  test("the newest of several updated entries wins", () => {
    const { unread } = prepare([
      gradeEntry({ id: 1, action: "updated", createdAt: "2026-11-02T08:00:00Z" }),
      gradeEntry({ id: 2, action: "updated", createdAt: "2026-11-03T08:00:00Z" }),
    ]);
    assert.deepEqual(unread.map((i) => i.id), [2]);
  });

  test("sorts unread and read newest first, ties keep feed order", () => {
    const { unread, read } = prepare([
      gradeEntry({ id: 1, gradeId: 1, createdAt: "2026-11-01T08:00:00Z" }),
      gradeEntry({ id: 2, gradeId: 2, createdAt: "2026-11-03T08:00:00Z" }),
      gradeEntry({ id: 3, gradeId: 3, createdAt: "2026-11-03T08:00:00Z" }),
      gradeEntry({ id: 4, gradeId: 4, createdAt: "2026-11-01T08:00:00Z", unread: false }),
      gradeEntry({ id: 5, gradeId: 5, createdAt: "2026-11-02T08:00:00Z", unread: false }),
    ]);
    assert.deepEqual(unread.map((i) => i.id), [2, 3, 1]);
    assert.deepEqual(read.map((i) => i.id), [5, 4]);
  });

  test("unreadCount equals the unread list length", () => {
    const result = prepare([gradeEntry({ id: 1 }), gradeEntry({ id: 2, gradeId: 2, unread: false }), infoEntry()]);
    assert.equal(result.unreadCount, 2);
    assert.equal(result.unreadCount, result.unread.length);
  });

  test("links a grade to its subject", () => {
    const [withSubject] = prepare([gradeEntry()]).unread;
    assert.equal(withSubject.href, "#/noten/5");
    const [without] = prepare([gradeEntry({ subjectId: null })]).unread;
    assert.equal(without.href, null);
  });

  test("joins the marked grade by id", () => {
    const grade = {
      id: 100,
      subjectId: 5,
      subjectName: "Mathe",
      collection: { name: "Test Brüche" },
      isNew: true,
    };
    const [item] = prepare([gradeEntry()], { grades: [grade] }).unread;
    assert.equal(item.grade, grade);
    assert.equal(item.kind, "new");
    assert.equal(item.subjectName, "Mathe");
    assert.equal(item.collectionName, "Test Brüche");
  });

  test("keeps the notification's names when the grade is unknown", () => {
    const [item] = prepare([gradeEntry()], { grades: [{ id: 999 }] }).unread;
    assert.equal(item.grade, null);
    assert.equal(item.subjectName, "Mathematik");
    assert.equal(item.collectionName, "Klassenarbeit 1");
  });

  test("links an info to its Schulinformation with the sender", () => {
    const [item] = prepare([infoEntry()], {
      announcements: [{ id: 9, title: "Wandertag", author: "Frau Muster" }],
    }).unread;
    assert.equal(item.kind, "info");
    assert.equal(item.href, "#/mehr/mitteilungen/9");
    assert.equal(item.title, "Wandertag");
    assert.equal(item.sender, "Frau Muster");
    assert.equal(item.grade, null);
    const [unknown] = prepare([infoEntry()]).unread;
    assert.equal(unknown.sender, null);
  });
});
