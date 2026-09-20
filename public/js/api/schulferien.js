// The one place that talks to schulferien-api.de.
//
// beste.schule tells us *which* days have no school but never what a break
// is called, and its list can be incomplete (this school recorded 15 of the
// 30 weekdays of the 2027 summer break). This service supplies the official
// state calendar: real names, real ranges.
//
// Endpoint choice, measured — all of these can answer the question, but not
// at the same cost for one school year:
//
//   v1/{year}/{state}            2 requests, needs merge + dedupe
//   v2/{year}/{state}?from=&to=  2 requests — the {year} segment still bounds
//                                the range, so it can't span a school year
//   v2/date/{date}?states=       1 request per block (~8); does return the
//                                containing range, not just a boolean
//   v2/next/{days}?states=       1 request, already forward-looking + sorted
//
// It is a community project (hand-maintained JSON, one file per year; 2029
// already 500s), so nothing here is allowed to throw: every failure resolves
// to [] and the caller falls back to the local heuristic. A worse label is
// acceptable; a missing screen is not.

import { cached } from "../data/cache.js";

const BASE_URL = "https://schulferien-api.de/api/v2";
const LOOKAHEAD_DAYS = 365;
const REQUEST_TIMEOUT_MS = 8_000;
// The calendar changes approximately never, so a long cache is safe. The
// endpoint is relative to "now", but a day's drift on a 365-day window
// changes nothing we display, so the key stays time-independent.
const STALE_MS = 12 * 60 * 60_000;

/** beste.schule's /api/school returns the full German name; this API takes codes. */
const STATE_CODES = {
  "Baden-Württemberg": "BW",
  Bayern: "BY",
  Berlin: "BE",
  Brandenburg: "BB",
  Bremen: "HB",
  Hamburg: "HH",
  Hessen: "HE",
  "Mecklenburg-Vorpommern": "MV",
  Niedersachsen: "NI",
  "Nordrhein-Westfalen": "NW",
  "Rheinland-Pfalz": "RP",
  Saarland: "SL",
  Sachsen: "SN",
  "Sachsen-Anhalt": "ST",
  "Schleswig-Holstein": "SH",
  Thüringen: "TH",
};

export function stateCodeFor(stateName) {
  return STATE_CODES[String(stateName ?? "").trim()] ?? null;
}

/**
 * Dates arrive as "2027-08-20T23:59Z" — an *inclusive* end, one minute shy
 * of midnight. Slicing the string is deliberate: reading local date parts off
 * `new Date()` rolls that into the 21st at any positive UTC offset, which
 * includes Europe/Berlin, where this app actually runs. Verified: in
 * Europe/Berlin the parsed local date is 2027-08-21, the slice is 2027-08-20.
 */
function toIsoDate(value) {
  return String(value ?? "").slice(0, 10);
}

/**
 * `next` is relative to now, so late in a school year it also returns the
 * *following* year's autumn break. The summer holidays end a school year by
 * definition, so cutting there needs no date arithmetic and stays correct
 * whenever the screen is opened.
 */
function untilSummerInclusive(entries) {
  const index = entries.findIndex((entry) => entry.name === "Sommerferien");
  return index === -1 ? entries : entries.slice(0, index + 1);
}

function normalize(raw) {
  return {
    name: raw?.name_cp ?? raw?.name ?? "",
    from: toIsoDate(raw?.start),
    to: toIsoDate(raw?.end),
  };
}

/**
 * Official school holidays for the year ahead.
 * @param {string} stateName e.g. "Sachsen", straight from /api/school
 * @returns {Promise<{name: string, from: string, to: string}[]>} [] on any failure
 */
export async function fetchSchulferien(stateName) {
  const code = stateCodeFor(stateName);
  if (!code) return [];

  return cached(
    `schulferien:${code}`,
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(
          `${BASE_URL}/next/${LOOKAHEAD_DAYS}?states=${encodeURIComponent(code)}`,
          { headers: { Accept: "application/json" }, signal: controller.signal }
        );
        if (!res.ok) return [];
        const body = await res.json();
        const rows = Array.isArray(body) ? body : (body?.holidays ?? body?.data ?? []);
        if (!Array.isArray(rows)) return [];

        const entries = rows
          .map(normalize)
          .filter((entry) => entry.name && entry.from && entry.to)
          .sort((a, b) => a.from.localeCompare(b.from));
        return untilSummerInclusive(entries);
      } catch {
        // Offline, timed out, CORS, malformed JSON, service gone — all the
        // same answer: we simply don't have official names this time.
        return [];
      } finally {
        clearTimeout(timeout);
      }
    },
    { staleMs: STALE_MS }
  );
}
