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

function capsuleClass(grade) {
  return scaleUnit(grade.scale, grade.numeric) ? "grade-capsule grade-capsule--points" : "grade-capsule";
}

function stickerBox(grade, kind) {
  const value = escapeHtml(gradeValue(grade));
  if (kind === "changed") {
    return `<span class="${capsuleClass(grade)}">${value}<span class="grade-sticker grade-sticker--changed" aria-hidden="true">GEÄNDERT</span></span>`;
  }
  return `<span class="${capsuleClass(grade)}">${value}<span class="grade-sticker" aria-hidden="true">NEU</span></span>`;
}

/** The grade box with its state: NEU or GEÄNDERT (old value struck) while unseen, otherwise a check to its left. */
export function gradeCapsule(grade) {
  if (grade.isChanged && grade.previous) {
    const previous = escapeHtml(gradeValue(grade.previous));
    return `<div class="grade-capsule-wrap"><s class="grade-previous">${previous}</s>${stickerBox(grade, "changed")}<span class="sr-only">, geändert, vorher ${previous}</span></div>`;
  }
  if (grade.isNew) {
    return `<div class="grade-capsule-wrap">${stickerBox(grade, "new")}<span class="sr-only">, neu, noch nicht gesehen</span></div>`;
  }
  const label = grade.readByGuardian ? "Von den Eltern gesehen" : "Gesehen";
  const value = escapeHtml(gradeValue(grade));
  return `<div class="grade-capsule-wrap">${seenCheck(label)}<span class="${capsuleClass(grade)}">${value}</span></div>`;
}

/** The box with its NEU or GEÄNDERT sticker whatever the read state; for notification cards. */
export function noticeCapsule(grade, kind) {
  return `<div class="grade-capsule-wrap">${stickerBox(grade, kind)}</div>`;
}
