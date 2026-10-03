import { getSelectedStudentId } from "./auth-store.js";
import { getSchoolContext } from "../data/context.js";

let cached = null;
let cachedStudentId = null;

/** The current student's scale, year and interval, resolved once. */
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
