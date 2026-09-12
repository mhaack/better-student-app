import { fetchDayPlans, fetchCurrentTimetable, isoDate } from "./repository.js";
import { apiWeekday, lessonsForDate } from "./timetable.js";

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr"];

/** Midnight on the Monday of `date`'s week. */
function mondayOf(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (apiWeekday(d) - 1));
  return d;
}

/**
 * Always Mo-Fr — this week while today is a school day, next week once the
 * weekend starts, so the grid never shows a week that's already over.
 */
export function resolveWeekStart(today) {
  const monday = mondayOf(today);
  const weekday = apiWeekday(today);
  return weekday >= 6 ? new Date(monday.getTime() + 7 * 86_400_000) : monday;
}

const DAY_MONTH_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric" });

/**
 * Aggregates the Mo-Fr grid: one column per weekday, one row per period that
 * occurs on any of the five days, each cell either a lesson (with status) or
 * empty. Weeks are fetched as a whole because a single substitution-plan
 * call for the range is cheaper than five separate day calls.
 *
 * `weekOffset` moves forward in whole weeks from `resolveWeekStart`'s
 * default (this week, or next week once it's the weekend) — the caller is
 * responsible for clamping it to the navigable range.
 */
export async function getStundenplanData(weekOffset = 0) {
  const today = new Date();
  const weekStart = new Date(resolveWeekStart(today).getTime() + weekOffset * 7 * 86_400_000);
  const dates = Array.from({ length: 5 }, (_, i) => new Date(weekStart.getTime() + i * 86_400_000));

  const fromIso = isoDate(dates[0]);
  const toIso = isoDate(dates[4]);
  const todayIso = isoDate(today);

  const [dayPlans, timetable] = await Promise.all([fetchDayPlans(fromIso, toIso), fetchCurrentTimetable()]);

  const days = dates.map((date, index) => ({
    date,
    iso: isoDate(date),
    label: WEEKDAY_LABELS[index],
    dateLabel: DAY_MONTH_FORMAT.format(date),
    isToday: isoDate(date) === todayIso,
    lessons: lessonsForDate(date, dayPlans, timetable),
  }));

  const maxPeriod = Math.max(1, ...days.flatMap((d) => d.lessons.map((l) => l.period)));
  const grid = Array.from({ length: maxPeriod }, (_, i) => {
    const period = i + 1;
    return {
      period,
      cells: days.map((day) => day.lessons.find((l) => l.period === period) ?? null),
    };
  });

  const changeCount = days.reduce((sum, d) => sum + d.lessons.filter((l) => l.status !== "regular").length, 0);

  // How many whole weeks the shown week is ahead of the actual current
  // calendar week — 0 even when resolveWeekStart already auto-jumped to next
  // week over the weekend, so the view can phrase both that and manual
  // forward navigation the same way.
  const weeksFromNow = Math.round((weekStart.getTime() - mondayOf(today).getTime()) / (7 * 86_400_000));

  return {
    days,
    grid,
    changeCount,
    weeksFromNow,
  };
}
