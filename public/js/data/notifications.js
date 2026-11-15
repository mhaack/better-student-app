import { fetchAnnouncements, fetchGrades, fetchNotifications, fetchRole } from "./repository.js";
import { markNewGrades } from "../domain/grades.js";

const KIND_BY_ACTION = { created: "new", updated: "changed" };

/** Newest first; Array.sort is stable, so ties keep the feed order. */
function newestFirst(items) {
  return [...items].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/**
 * One entry per grade. An update outranks the creation even if its timestamp is
 * older, so a grade that was created and later changed shows once, as changed.
 */
function onePerGrade(entries) {
  const best = new Map();
  for (const entry of entries) {
    if (entry.type !== "grade") continue;
    const key = gradeKey(entry);
    const current = best.get(key);
    if (!current || outranks(entry, current)) best.set(key, entry);
  }
  return entries.filter((e) => e.type !== "grade" || best.get(gradeKey(e)) === e);
}

// Entries without a grade id must not collapse into one bucket.
const gradeKey = (entry) => entry.gradeId ?? `notification-${entry.id}`;

function outranks(entry, best) {
  if (entry.action !== best.action) return entry.action === "updated";
  return (entry.createdAt ?? "") > (best.createdAt ?? "");
}

function gradeItem(entry, grades) {
  const grade = grades.find((g) => g.id === entry.gradeId) ?? null;
  return {
    id: entry.id,
    kind: KIND_BY_ACTION[entry.action],
    unread: entry.unread,
    createdAt: entry.createdAt,
    href: entry.subjectId != null ? `#/noten/${entry.subjectId}` : null,
    subjectName: grade?.subjectName ?? entry.subjectName,
    collectionName: grade?.collection?.name ?? entry.collectionName,
    grade,
    title: null,
    sender: null,
  };
}

function infoItem(entry, announcements) {
  const announcement = announcements.find((a) => a.id === entry.announcementId);
  return {
    id: entry.id,
    kind: "info",
    unread: entry.unread,
    createdAt: entry.createdAt,
    // The detail page errors for an announcement that isn't in the list.
    href: announcement ? `#/mehr/mitteilungen/${announcement.id}` : null,
    subjectName: null,
    collectionName: null,
    grade: null,
    title: entry.title,
    sender: announcement?.author ?? null,
  };
}

/** Filters, dedupes and joins the bell feed for the Benachrichtigungen screen. Pure. */
export function prepareNotifications(notifications, { grades, announcements, studentId }) {
  const relevant = notifications.filter((n) => {
    if (n.type === "announcement") return true;
    // Announcements aren't per child; grade entries are.
    return n.type === "grade" && n.action in KIND_BY_ACTION && (n.studentId == null || n.studentId === studentId);
  });

  const items = onePerGrade(relevant).map((n) =>
    n.type === "grade" ? gradeItem(n, grades) : infoItem(n, announcements)
  );
  const sorted = newestFirst(items);
  const unread = sorted.filter((i) => i.unread);
  return { unread, read: sorted.filter((i) => !i.unread), unreadCount: unread.length };
}

export async function getNotificationsData(studentId, scale) {
  // A failing `/api/me` only costs the grades' read markers.
  const [notifications, grades, announcements, role] = await Promise.all([
    fetchNotifications(),
    fetchGrades(studentId, { scale }),
    // Only needed for the sender; the feed is worth showing without it.
    fetchAnnouncements().catch(() => []),
    fetchRole(),
  ]);
  return prepareNotifications(notifications, {
    grades: markNewGrades(grades, role),
    announcements,
    studentId,
  });
}

/** For the bell: a failing feed means no badge, never an error on Heute. */
export async function unreadNotificationCount(studentId, scale) {
  try {
    return (await getNotificationsData(studentId, scale)).unreadCount;
  } catch {
    return 0;
  }
}
