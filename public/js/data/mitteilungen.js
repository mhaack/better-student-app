import { fetchAnnouncements, isoDate } from "./repository.js";
import { splitAttachments, messagePreview } from "../domain/markdown.js";

// Heute only shows what's new. "Unread" alone isn't enough: this app can't
// mark anything read (read-only; write routes' CORS is unconfirmed), so an
// item stays unread until it's confirmed on beste.schule — and a letter can
// be visible for a whole school year. Unread *and* recent keeps Heute honest.
const FRESH_DAYS = 14;

/**
 * Sorts, derives read state, pulls attachment links out of the body and
 * picks what Heute and the Mehr badge show. Pure, so it's testable with a
 * fixed `today`.
 */
export function prepareMitteilungen(announcements, today = new Date()) {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - FRESH_DAYS);
  const cutoffIso = isoDate(cutoff);

  const items = announcements
    .map((a) => {
      const { body, attachments } = splitAttachments(a.body);
      return { ...a, body, attachments, read: a.readCount > 0, preview: messagePreview(body) };
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
  return prepareMitteilungen(await fetchAnnouncements());
}
