// The one place that talks to schulferien-api.de: official Ferien names and
// ranges, which beste.schule lacks. v2/next is the only endpoint that covers
// a school year in one request. It's a community project, so nothing here
// throws: every failure resolves to [] and the caller uses its heuristic.

import { cached } from "../data/cache.js";

const BASE_URL = "https://schulferien-api.de/api/v2";
const LOOKAHEAD_DAYS = 365;
const REQUEST_TIMEOUT_MS = 8_000;
// The calendar hardly changes; a day's drift of "next 365" doesn't matter.
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
 * Dates arrive as "2027-08-20T23:59Z" (inclusive end). Sliced, not parsed:
 * `new Date()` would roll it into the 21st in Europe/Berlin.
 */
function toIsoDate(value) {
  return String(value ?? "").slice(0, 10);
}

/** `next` can reach into the following school year; cut after Sommerferien. */
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

  try {
    // Throw inside the fetcher so cached() doesn't keep the failure.
    return await cached(
      `schulferien:${code}`,
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          const res = await fetch(
            `${BASE_URL}/next/${LOOKAHEAD_DAYS}?states=${encodeURIComponent(code)}`,
            { headers: { Accept: "application/json" }, signal: controller.signal }
          );
          if (!res.ok) throw new Error(`schulferien-api.de: HTTP ${res.status}`);
          const body = await res.json();
          const rows = Array.isArray(body) ? body : (body?.holidays ?? body?.data);
          if (!Array.isArray(rows)) throw new Error("schulferien-api.de: unexpected body");

          const entries = rows
            .map(normalize)
            .filter((entry) => entry.name && entry.from && entry.to)
            .sort((a, b) => a.from.localeCompare(b.from));
          return untilSummerInclusive(entries);
        } finally {
          clearTimeout(timeout);
        }
      },
      { staleMs: STALE_MS }
    );
  } catch {
    // Any failure: no official names this time.
    return [];
  }
}
