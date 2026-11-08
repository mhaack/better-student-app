import { escapeHtml } from "../util/dom.js";
import { scaleUnit } from "../util/format.js";

const CHECK_PATH = "M6.6 11.3l3 3 5.8-6.4";

function seenCheck(label) {
  return `<svg class="grade-seen" viewBox="0 0 22 22" role="img" aria-label="${label}"><circle cx="11" cy="11" r="11"/><path d="${CHECK_PATH}" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** "2-" as typed, or "14 P" for points; the raw text if it didn't parse. */
export function gradeValue(grade) {
  const unit = scaleUnit(grade.scale, grade.numeric);
  return unit ? `${grade.numeric}${unit}` : (grade.raw ?? "");
}

/** A NEU sticker at the start of a row while unseen; nothing once seen. */
export function newSticker(grade) {
  if (!grade.isNew) return "";
  return '<span class="grade-sticker grade-sticker--lead" aria-hidden="true">NEU</span><span class="sr-only">Neu, noch nicht gesehen: </span>';
}

/** The grade box with its state: a NEU sticker while unseen, otherwise a check to its left. */
export function gradeCapsule(grade) {
  const value = escapeHtml(gradeValue(grade));
  const capsuleClass = scaleUnit(grade.scale, grade.numeric) ? "grade-capsule grade-capsule--points" : "grade-capsule";
  if (grade.isNew) {
    return `<div class="grade-capsule-wrap"><span class="${capsuleClass}">${value}<span class="grade-sticker" aria-hidden="true">NEU</span><span class="sr-only">, neu, noch nicht gesehen</span></span></div>`;
  }
  const label = grade.readByGuardian ? "Von den Eltern gesehen" : "Gesehen";
  return `<div class="grade-capsule-wrap">${seenCheck(label)}<span class="${capsuleClass}">${value}</span></div>`;
}
