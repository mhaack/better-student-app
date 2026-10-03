// Raw API JSON → domain objects. Raw items mirror the live API's shape
// (docs/api-notes.md); the texts are made up.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mapAnnouncement, mapMe } from "../../public/js/api/mappers.js";
import { rawAnnouncement } from "../support/announcements.mjs";

describe("mapAnnouncement", () => {
  test("date comes from read_from (there is no created_at)", () => {
    const a = mapAnnouncement(rawAnnouncement());
    assert.equal(a.date, "2026-08-17");
    assert.equal(a.visibleUntil, "2027-09-01");
  });

  test("read state stays split by role, never summed", () => {
    const a = mapAnnouncement(rawAnnouncement());
    assert.equal(a.readByGuardian, true);
    assert.equal(a.readByStudent, false);
    const b = mapAnnouncement(rawAnnouncement({ read_guardians_count: 0, read_students_count: 1 }));
    assert.equal(b.readByGuardian, false);
    assert.equal(b.readByStudent, true);
    // Without the include the counts are absent — treat as unread, not crash.
    const { read_guardians_count, read_students_count, ...bare } = rawAnnouncement();
    assert.equal(mapAnnouncement(bare).readByGuardian, false);
    assert.equal(mapAnnouncement(bare).readByStudent, false);
  });

  test("title, body, type, author, confirmation flags", () => {
    const a = mapAnnouncement(rawAnnouncement());
    assert.equal(a.id, 2982);
    assert.equal(a.title, "Belehrung Sportunterricht");
    assert.match(a.body, /^Liebe Erziehungsberechtigte,/);
    assert.equal(a.type, "Elternbrief");
    assert.equal(a.author, "Anna Müller");
    assert.equal(a.needsGuardianConfirmation, true);
    assert.equal(a.needsStudentConfirmation, false);
  });

  test("no teacher include, no confirmation", () => {
    const a = mapAnnouncement(
      rawAnnouncement({ teacher: undefined, need_confirmation_from_guardian: 0, need_confirmation_from_student: 0 })
    );
    assert.equal(a.author, null);
    assert.equal(a.needsGuardianConfirmation, false);
    assert.equal(a.needsStudentConfirmation, false);
  });
});

describe("mapMe", () => {
  test("keeps the role and drops everything else", () => {
    // Asserts the whole result, so a new personal field can't slip through.
    const raw = {
      id: 9,
      role: "guardian",
      username: "hmuster",
      email: "h.muster@example.org",
      email_private: null,
      phone_private: "0170 0000000",
      guardian: { id: 2256, forename: "Hanna", name: "Muster", email_private: "h@example.org" },
      students: [{ id: 30762, forename: "Mia", name: "Muster", birthday: "2009-11-13" }],
      teacher: null,
      school: { id: 1 },
      unread_notifications_count: 3,
    };
    assert.deepEqual(mapMe(raw), { role: "guardian" });
  });

  test("a student session, and an unknown shape", () => {
    assert.deepEqual(mapMe({ role: "student" }), { role: "student" });
    assert.deepEqual(mapMe({}), { role: null });
    assert.deepEqual(mapMe(null), { role: null });
  });
});
