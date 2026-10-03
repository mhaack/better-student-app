// Sorting announcements, and their read and confirmation state per role.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mapAnnouncement } from "../../public/js/api/mappers.js";
import { prepareMitteilungen } from "../../public/js/data/mitteilungen.js";
import { rawAnnouncement } from "../support/announcements.mjs";

const TODAY = new Date(2026, 8, 29); // 29.09.2026

function mapped(overrides) {
  return mapAnnouncement(rawAnnouncement(overrides));
}

/** The one prepared item for a raw announcement, as `role` sees it. */
function seenBy(role, overrides = {}) {
  return prepareMitteilungen([mapped(overrides)], TODAY, role).items[0];
}

describe("prepareMitteilungen", () => {
  test("newest first, id breaks ties", () => {
    const { items } = prepareMitteilungen(
      [
        mapped({ id: 1, read_from: "2026-08-17" }),
        mapped({ id: 2, read_from: "2026-09-23" }),
        mapped({ id: 3, read_from: "2026-09-23" }),
      ],
      TODAY
    );
    assert.deepEqual(items.map((i) => i.id), [3, 2, 1]);
  });

  test("read, attachments and preview per item", () => {
    const [item] = prepareMitteilungen([mapped()], TODAY, "guardian").items;
    assert.equal(item.read, true);
    assert.equal(item.attachments.length, 1);
    assert.doesNotMatch(item.body, /attachments/);
    assert.equal(item.preview, "bitte lesen Sie die Belehrung. Die Fachschaft Sport");
  });

  test("a guardian's read state ignores the student's", () => {
    // Summed counts hid the guardian's open Lesebestätigung once the child read it.
    const item = seenBy("guardian", { read_guardians_count: 0, read_students_count: 1 });
    assert.equal(item.read, false);
    assert.equal(item.canConfirm, true);
  });

  test("a student's read state ignores the guardian's", () => {
    const item = seenBy("student", {
      read_guardians_count: 1,
      read_students_count: 0,
      need_confirmation_from_student: 1,
    });
    assert.equal(item.read, false);
    assert.equal(item.canConfirm, true);
  });

  test("no confirmation offered once this role has read it", () => {
    const item = seenBy("guardian");
    assert.equal(item.read, true);
    assert.equal(item.canConfirm, false);
  });

  test("unread but no confirmation asked of this role", () => {
    // The letter only wants the student's signature.
    const raw = {
      read_guardians_count: 0,
      read_students_count: 0,
      need_confirmation_from_guardian: 0,
      need_confirmation_from_student: 1,
    };
    assert.equal(seenBy("guardian", raw).canConfirm, false);
    assert.equal(seenBy("student", raw).canConfirm, true);
  });

  test("unknown role never offers to confirm", () => {
    // Read state still falls back to either count, so the unread badge works.
    const item = seenBy(null, { read_guardians_count: 0, read_students_count: 1 });
    assert.equal(item.read, true);
    assert.equal(item.canConfirm, false);
  });

  test("fresh = unread and at most 14 days old", () => {
    const { fresh, unreadCount } = prepareMitteilungen(
      [
        mapped({ id: 1, read_from: "2026-09-23", read_guardians_count: 0 }), // unread, 6 days
        mapped({ id: 2, read_from: "2026-09-15", read_guardians_count: 0 }), // unread, exactly 14 days
        mapped({ id: 3, read_from: "2026-09-14", read_guardians_count: 0 }), // unread, 15 days — too old for Heute
        mapped({ id: 4, read_from: "2026-09-28", read_guardians_count: 1 }), // read
      ],
      TODAY,
      "guardian"
    );
    assert.deepEqual(fresh.map((i) => i.id), [1, 2]);
    assert.equal(unreadCount, 3);
  });

  test("nothing new → empty fresh list", () => {
    const { fresh, unreadCount } = prepareMitteilungen([mapped()], TODAY, "guardian");
    assert.deepEqual(fresh, []);
    assert.equal(unreadCount, 0);
  });
});
