import { fetchAnnouncements, fetchRole, isoDate } from "./repository.js";
import { splitAttachments, messagePreview } from "../domain/markdown.js";

// Unread alone isn't enough for Heute: a letter can stay visible for a year.
const FRESH_DAYS = 14;

/** The guardian or student field for `role`; either when unknown. */
function forRole(role, guardianValue, studentValue) {
  if (role === "guardian") return guardianValue;
  if (role === "student") return studentValue;
  return guardianValue || studentValue;
}

/** Sorts, derives read and confirmation state, splits attachments. Pure. */
export function prepareMitteilungen(announcements, today = new Date(), role = null) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - FRESH_DAYS);
  const cutoffIso = isoDate(cutoff);

  const items = announcements
    .map((a) => {
      const { body, attachments } = splitAttachments(a.body);
      const read = forRole(role, a.readByGuardian, a.readByStudent);
      const needsConfirmation = forRole(role, a.needsGuardianConfirmation, a.needsStudentConfirmation);
      return {
        ...a,
        body,
        attachments,
        read,
        needsConfirmation,
        // Needs a role: whose confirmation would we send?
        canConfirm: Boolean(role) && needsConfirmation && !read,
        preview: messagePreview(body),
      };
    })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id);

  const unread = items.filter((i) => !i.read);
  return {
    items,
    fresh: unread.filter((i) => (i.date ?? "") >= cutoffIso),
    unreadCount: unread.length,
  };
}

export async function getMitteilungenData() {
  // A failing `/api/me` costs the buttons, not the screen.
  const [announcements, role] = await Promise.all([fetchAnnouncements(), fetchRole()]);
  return prepareMitteilungen(announcements, new Date(), role);
}
