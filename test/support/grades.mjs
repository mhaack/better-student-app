// The change log of a grade as the live API returns it (docs/api-notes.md); people are invented.
const GUARDIAN = { id: 9001, forename: "Erika", name: "Beispiel", email: "erika.beispiel@example.invalid", phone: "0151 0000000" };
const TEACHER = { id: 205, local_id: "RCH", forename: "Sabine", name: "Reich", email: "s.reich@example.invalid", phone: "0151 1111111" };

/** "History Flash mdl.": created, read by a guardian, changed 3 -> 8, then the read markers reset. */
export function historyFlashHistories() {
  const entry = (id, conductor, fields) => ({
    id,
    action: "updated",
    attr: null,
    old_value: null,
    body: null,
    conductor_type: "App\\Models\\Teacher",
    conductor,
    ...fields,
  });
  return [
    entry(1, TEACHER, { action: "created" }),
    entry(2, GUARDIAN, { attr: "read_at", old_value: null }),
    entry(3, GUARDIAN, { attr: "read_by_type", old_value: null }),
    entry(4, GUARDIAN, { attr: "read_by_id", old_value: null }),
    entry(5, TEACHER, { attr: "value", old_value: "3", body: "Updated Value ('3' -> '8')" }),
    entry(6, TEACHER, { attr: "read_at", old_value: "2026-11-08 10:00:00" }),
    entry(7, TEACHER, { attr: "read_by_type", old_value: "guardian" }),
    entry(8, TEACHER, { attr: "read_by_id", old_value: "9001" }),
  ];
}
