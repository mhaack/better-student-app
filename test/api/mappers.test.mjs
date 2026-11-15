// Raw API JSON → domain objects. Raw items mirror the live API's shape
// (docs/api-notes.md); the texts are made up.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { mapAnnouncement, mapGrade, mapMe, mapNotification } from "../../public/js/api/mappers.js";
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

describe("mapGrade", () => {
  const rawGrade = (overrides) => ({
    id: 71194131,
    value: "10",
    given_at: "2026-11-03",
    read: true,
    read_by_type: "guardian",
    collection: { id: 4370299, type: "KL", weighting: 1, name: "Klausur Mechanik", subject_id: 77 },
    teacher: { id: 205, local_id: "RCH", forename: "Sabine", name: "Reich" },
    ...overrides,
  });

  test("marks a grade a guardian has read as acknowledged", () => {
    assert.equal(mapGrade(rawGrade(), "points_0_15").readByGuardian, true);
  });

  test("does not count a read by someone other than a guardian", () => {
    assert.equal(mapGrade(rawGrade({ read_by_type: "student" }), "points_0_15").readByGuardian, false);
  });

  test("leaves an unread grade unacknowledged", () => {
    assert.equal(mapGrade(rawGrade({ read: false, read_by_type: null }), "points_0_15").readByGuardian, false);
  });

  const entry = (id, attr, old_value = null) => ({ id, action: "updated", attr, old_value });

  test("takes the old value from the last value change", () => {
    const histories = [
      entry(1, null),
      entry(2, "read_at"),
      entry(3, "value", "3"),
      entry(4, "read_at"),
      entry(5, "read_at"),
    ];
    const { previous } = mapGrade(rawGrade({ histories }), "points_0_15");
    assert.equal(previous.raw, "3");
    assert.equal(previous.numeric, 3);
  });

  test("uses the highest id when the value changed twice", () => {
    const histories = [entry(9, "value", "7"), entry(4, "value", "3")];
    assert.equal(mapGrade(rawGrade({ histories }), "points_0_15").previous.raw, "7");
  });

  test("ignores read-marker entries", () => {
    const histories = [entry(2, "read_at"), entry(3, "read_by_type")];
    assert.equal(mapGrade(rawGrade({ histories }), "points_0_15").previous, null);
  });

  test("has no previous without histories", () => {
    assert.equal(mapGrade(rawGrade(), "points_0_15").previous, null);
  });
});

describe("mapNotification", () => {
  const rawNotification = (overrides) => ({
    id: "8f0c6d1e-2b4a-4c55-9e1f-3a7b9d2c4e60",
    notification_type: "grade",
    action: "created",
    created_at: "2026-11-07",
    read_at: null,
    redirect_url: "https://beste.schule/students/1/grades",
    notifiable_type: "user",
    data: { collection_name: "Klausur Mechanik", subject_name: "Physik" },
    grade: {
      id: 71300001,
      value: "10",
      student_id: 1,
      collection: { id: 4370299, subject_id: 77, subject: { id: 77, name: "Physik" } },
    },
    notifiable: { id: 5, email: "eltern@example.org", role: "guardian" },
    ...overrides,
  });

  test("maps a grade entry to the flat shape", () => {
    assert.deepEqual(mapNotification(rawNotification()), {
      id: "8f0c6d1e-2b4a-4c55-9e1f-3a7b9d2c4e60",
      type: "grade",
      action: "created",
      createdAt: "2026-11-07",
      unread: true,
      gradeId: 71300001,
      studentId: 1,
      subjectId: 77,
      subjectName: "Physik",
      collectionName: "Klausur Mechanik",
      announcementId: null,
      title: null,
    });
  });

  test("maps an announcement entry without its message or the user", () => {
    const n = mapNotification(
      rawNotification({
        notification_type: "announcement",
        data: { title: "Information Bedrohungssituation" },
        grade: undefined,
        announcement: { id: 3866, title: "Information Bedrohungssituation", message: "Liebe Eltern ..." },
      })
    );
    assert.equal(n.type, "announcement");
    assert.equal(n.announcementId, 3866);
    assert.equal(n.title, "Information Bedrohungssituation");
    assert.equal(n.gradeId, null);
    assert.equal("message" in n, false);
    assert.equal("notifiable" in n, false);
  });

  test("a read entry is not unread", () => {
    assert.equal(mapNotification(rawNotification({ read_at: "2026-11-08 10:00:00" })).unread, false);
  });

  test("tolerates an entry without an embedded grade", () => {
    assert.equal(mapNotification(rawNotification({ grade: null })).gradeId, null);
  });
});
