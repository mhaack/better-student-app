const WEEKDAY_FORMAT = new Intl.DateTimeFormat("de-DE", { weekday: "long" });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });

/** "Montag" if within the next 6 days, otherwise "12.09." */
export function weekdayOrDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const days = Math.round((date - startOfToday()) / 86_400_000);
  if (days >= 0 && days < 7) return WEEKDAY_FORMAT.format(date);
  return SHORT_DATE_FORMAT.format(date);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatAverage(value, scale) {
  if (value === null || value === undefined) return "–";
  return scale === "points_0_15"
    ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/** The overall average always shows 2 decimals on the grade_1_6 scale, matching the design's "2,31". */
export function formatOverallAverage(value, scale) {
  if (value === null || value === undefined) return "–";
  return scale === "points_0_15"
    ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
