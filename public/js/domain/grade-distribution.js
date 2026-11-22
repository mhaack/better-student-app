// How a Halbjahr's grades spread over the scale, for the Noten charts.
// Only whole values are counted: a tendency (2+, 2-) is its Note.
import { gradeTypeLabel } from "./grades.js";

/** @typedef {{ subjectId: number, value: number, kind: "ka" | "sl" }} DistributionEntry */

const NOTE_VALUES = [1, 2, 3, 4, 5, 6];
const POINT_VALUES = Array.from({ length: 16 }, (_, i) => 15 - i);
const KA_LABELS = new Set(["Klausur", "Klassenarbeit"]);

/** Points as a whole Note: 15–13 = 1, 12–10 = 2, … 3–1 = 5, 0 = 6. */
export function pointsToNote(points) {
  const clamped = Math.max(0, Math.min(15, Math.round(points)));
  return clamped === 0 ? 6 : 5 - Math.floor((clamped - 1) / 3);
}

/** A parsed Note (2.25 for "2-", 1.75 for "2+") as its whole Note 1–6. */
export function wholeNote(numeric) {
  return Math.max(1, Math.min(6, Math.round(numeric)));
}

/** "ka" for Klausuren/Klassenarbeiten; Leistungskontrollen and unknown codes are Sonstige. */
export function gradeKind(collectionType) {
  return KA_LABELS.has(gradeTypeLabel(collectionType)) ? "ka" : "sl";
}

/**
 * @param {DistributionEntry[]} entries values are whole Notes on grade_1_6, points on points_0_15
 * @param {{ scale: import('./grades.js').GradeScale, unit: "notes" | "points" }} options
 * @returns {{ unit: "notes" | "points", count: number, mean: number | null,
 *   buckets: Array<{ label: string, value: number, ka: number, sl: number, total: number, share: number }> }}
 */
export function gradeDistribution(entries, { scale, unit }) {
  const toUnit = scale === "points_0_15" && unit === "notes" ? pointsToNote : (value) => value;
  const buckets = (unit === "points" ? POINT_VALUES : NOTE_VALUES).map((value) => ({
    label: String(value),
    value,
    ka: 0,
    sl: 0,
    total: 0,
    share: 0,
  }));
  const byValue = new Map(buckets.map((bucket) => [bucket.value, bucket]));

  let sum = 0;
  for (const entry of entries) {
    const value = toUnit(entry.value);
    const bucket = byValue.get(value);
    if (!bucket) continue;
    bucket[entry.kind === "ka" ? "ka" : "sl"] += 1;
    bucket.total += 1;
    sum += value;
  }

  const count = buckets.reduce((total, bucket) => total + bucket.total, 0);
  for (const bucket of buckets) bucket.share = count ? bucket.total / count : 0;
  return { unit, count, mean: count ? sum / count : null, buckets };
}
