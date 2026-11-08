import { periodLabel } from "../util/format.js";
import { openDetailSheet, homeworkCard } from "./detail-sheet.js";
import { openExamSheet } from "./exam-sheet.js";

const STATUS_EYEBROW = {
  cancelled: "Entfällt",
  room_change: "Raumänderung",
  substitution: "Vertretung",
  changed: "Geändert",
};

/** "Vertretung", "Entfällt", …; nothing for a regular lesson. */
export function lessonStatusLabel(lesson) {
  return lesson.status === "regular" ? undefined : (STATUS_EYEBROW[lesson.status] ?? "Geändert");
}

/** Time, changes as "vorher → nachher", plus the school's note. */
function describeLesson(lesson) {
  const rows = [{ label: "Zeit", value: [periodLabel([lesson.period]), lesson.timeLabel].filter(Boolean).join(" · ") }];

  if (lesson.status === "room_change" && lesson.previousRoom) {
    rows.push({ label: "Raum", value: `${lesson.previousRoom} → ${lesson.room ?? "–"}` });
  } else if (lesson.room) {
    rows.push({ label: "Raum", value: lesson.room });
  }

  if (lesson.status === "substitution" && (lesson.previousTeacher || lesson.previousTeacherShort)) {
    const prev = lesson.previousTeacher ?? lesson.previousTeacherShort;
    const next = lesson.teacher ?? lesson.teacherShort ?? "–";
    rows.push({ label: "Lehrkraft", value: `${prev} → ${next}` });
  } else if (lesson.teacher) {
    rows.push({ label: "Lehrkraft", value: lesson.teacher });
  }

  return rows;
}

/**
 * The sheet behind a tapped lesson. A test lesson opens the test sheet even
 * when also changed; that sheet shows the new room and any homework.
 * `day` is a day from attachExams/attachHomework with `iso` and `countdown`.
 */
export function openLessonSheet(container, day, lesson, opener) {
  const exam = lesson.hasExam && day.exams?.find((e) => e.periods.includes(lesson.period));
  if (exam) {
    openExamSheet(container, [exam], opener, lesson.homework);
    return;
  }
  openDetailSheet(container, {
    eyebrow: lessonStatusLabel(lesson),
    title: lesson.subject ?? lesson.subjectShort ?? "",
    titleStruck: lesson.status === "cancelled",
    when: { countdown: day.countdown, iso: day.iso },
    rows: describeLesson(lesson),
    cards: [{ eyebrow: "Hinweis", text: lesson.notes?.[0] }, ...(lesson.homework ?? []).map(homeworkCard)],
  });
}
