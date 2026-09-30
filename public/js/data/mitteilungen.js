import { fetchAnnouncements, fetchRole, isoDate } from "./repository.js";
import { splitAttachments, messagePreview } from "../domain/markdown.js";

// Heute only shows what's new. "Unread" alone isn't enough: a letter stays
// unread until somebody confirms it, and one can be visible for a whole
// school year. Unread *and* recent keeps Heute honest.
const FRESH_DAYS = 14;

/**
 * Picks the side of a guardian/student field pair that speaks for the
 * signed-in role. With no role established (an `/api/me` that failed) either
 * side counts, which keeps the unread badge working — but callers must not
 * offer to *write* on that basis, since we can't tell who we'd be confirming
 * as.
 */
function forRole(role, guardianValue, studentValue) {
  if (role === "guardian") return guardianValue;
  if (role === "student") return studentValue;
  return guardianValue || studentValue;
}

/**
 * Sorts, derives read state, pulls attachment links out of the body and
 * picks what Heute and the Mehr badge show. Pure, so it's testable with a
 * fixed `today` and role.
 */
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
        // A known role is part of the condition: without one we'd be putting a
        // confirm button in front of someone whose confirmation may not even
        // be the one the letter asks for.
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
  // The role only decides how the list is labelled, so a failing `/api/me`
  // degrades to "no confirm buttons" instead of taking Mitteilungen with it.
  const [announcements, role] = await Promise.all([fetchAnnouncements(), fetchRole()]);
  return prepareMitteilungen(announcements, new Date(), role);
}
