// A raw announcement as the live API returns it (docs/api-notes.md); the texts are made up.
export function rawAnnouncement(overrides = {}) {
  return {
    id: 2982,
    title: "Belehrung Sportunterricht",
    message: "Liebe Erziehungsberechtigte,\n\nbitte lesen Sie die Belehrung.\n\nDie Fachschaft Sport  \n\n[Belehrung.pdf](/attachments/463)",
    read_from: "2026-08-17",
    read_to: "2027-09-01",
    write_from: "2026-08-01",
    write_to: "2026-10-01",
    for: "guardian",
    need_confirmation_from_student: 0,
    need_confirmation_from_guardian: 1,
    read_students_count: 0,
    read_guardians_count: 1,
    single_group: false,
    type: { id: 520, name: "Elternbrief", color: null, default: 0, default_for: "student" },
    teacher: { id: 1, local_id: "MUE", forename: "Anna", name: "Müller", tags: [] },
    ...overrides,
  };
}
