import { getSelectedStudentId } from "./auth-store.js";
import { getSchoolContext } from "../data/context.js";

let cached = null;
let cachedStudentId = null;

/**
 * Resolves (once, then caches) the current student's scale, year and
 * interval. Views call this instead of re-deriving school context each time.
 */
export async function ensureContext({ forceRefresh = false } = {}) {
  const studentId = getSelectedStudentId();
  if (!forceRefresh && cached && cachedStudentId === studentId) return cached;

  cached = await getSchoolContext(studentId);
  cachedStudentId = studentId;
  return cached;
}

export function resetContext() {
  cached = null;
  cachedStudentId = null;
}
