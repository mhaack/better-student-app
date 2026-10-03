// Tests for the schulferien-api.de client, with `fetch` stubbed. Every failure
// must resolve to [], never reject.
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

// The module caches per state, so each case uses a different one.
const { fetchSchulferien, stateCodeFor } = await import("../public/js/api/schulferien.js");

function stubFetch(impl) {
  mock.method(globalThis, "fetch", impl);
}
afterEach(() => mock.restoreAll());
function jsonOk(body) {
  return async () => ({ ok: true, status: 200, json: async () => body });
}

const entry = (name, start, end) => ({
  name_cp: name,
  name: name.toLowerCase(),
  start: `${start}T00:00Z`,
  end: `${end}T23:59Z`,
});

test("the state-name map covers all 16 Länder", () => {
  const states = [
    "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg",
    "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen",
    "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt",
    "Schleswig-Holstein", "Thüringen",
  ];
  const codes = states.map(stateCodeFor);
  assert.equal(codes.filter(Boolean).length, 16);
  assert.equal(new Set(codes).size, 16, "codes must be unique");
  assert.equal(stateCodeFor("Sachsen"), "SN");
  assert.equal(stateCodeFor("  Sachsen  "), "SN", "whitespace is tolerated");
});

test("an unknown or missing state yields [] without fetching", async () => {
  let called = false;
  stubFetch(async () => { called = true; });
  assert.deepEqual(await fetchSchulferien("Ruritanien"), []);
  assert.deepEqual(await fetchSchulferien(undefined), []);
  assert.deepEqual(await fetchSchulferien(null), []);
  assert.equal(called, false, "no request should be made without a valid code");
});

test("an inclusive 23:59Z end date is not rolled forward by the timezone", async () => {
  // The end is 23:59Z, which parsed as a local date in Berlin is the next
  // day. Explicit timeZone so it holds in any TZ.
  const berlin = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  });
  assert.equal(berlin.format(new Date("2027-08-20T23:59Z")), "2027-08-21",
    "precondition: parsing really does roll forward in Berlin");

  stubFetch(jsonOk([entry("Sommerferien", "2027-07-10", "2027-08-20")]));
  const [row] = await fetchSchulferien("Rheinland-Pfalz");
  assert.equal(row.to, "2027-08-20", "the client must keep the date the API meant");
});

test("entries are normalised to plain dates", async () => {
  stubFetch(jsonOk([entry("Herbstferien", "2026-10-12", "2026-10-24")]));
  const rows = await fetchSchulferien("Bayern");
  assert.deepEqual(rows, [{ name: "Herbstferien", from: "2026-10-12", to: "2026-10-24" }]);
});

test("the list is cut at the first Sommerferien, inclusive", async () => {
  // Anything after the summer break is next school year.
  stubFetch(
    jsonOk([
      entry("Herbstferien", "2026-10-12", "2026-10-24"),
      entry("Sommerferien", "2027-07-10", "2027-08-20"),
      entry("Herbstferien", "2027-10-11", "2027-10-23"),
      entry("Weihnachtsferien", "2027-12-23", "2028-01-01"),
    ])
  );
  const rows = await fetchSchulferien("Berlin");
  assert.deepEqual(rows.map((r) => r.name), ["Herbstferien", "Sommerferien"]);
});

test("late in the school year, Sommerferien may be the only entry kept", async () => {
  stubFetch(
    jsonOk([
      entry("Sommerferien", "2027-07-10", "2027-08-20"),
      entry("Herbstferien", "2027-10-11", "2027-10-23"),
    ])
  );
  const rows = await fetchSchulferien("Hamburg");
  assert.deepEqual(rows.map((r) => r.name), ["Sommerferien"]);
});

test("a response with no Sommerferien is kept whole", async () => {
  stubFetch(jsonOk([entry("Herbstferien", "2026-10-12", "2026-10-24")]));
  const rows = await fetchSchulferien("Bremen");
  assert.equal(rows.length, 1);
});

test("entries arrive sorted by start date", async () => {
  stubFetch(
    jsonOk([
      entry("Winterferien", "2027-02-08", "2027-02-19"),
      entry("Herbstferien", "2026-10-12", "2026-10-24"),
    ])
  );
  const rows = await fetchSchulferien("Hessen");
  assert.deepEqual(rows.map((r) => r.from), ["2026-10-12", "2027-02-08"]);
});

test("a 500 resolves to [] rather than rejecting", async () => {
  // The real service already does this for year 2029.
  stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  assert.deepEqual(await fetchSchulferien("Saarland"), []);
});

test("a 404 resolves to []", async () => {
  stubFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  assert.deepEqual(await fetchSchulferien("Thüringen"), []);
});

test("a network failure resolves to []", async () => {
  stubFetch(async () => { throw new TypeError("Failed to fetch"); });
  assert.deepEqual(await fetchSchulferien("Brandenburg"), []);
});

test("malformed JSON resolves to []", async () => {
  stubFetch(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } }));
  assert.deepEqual(await fetchSchulferien("Niedersachsen"), []);
});

test("an unexpected body shape resolves to []", async () => {
  stubFetch(jsonOk({ unexpected: true }));
  assert.deepEqual(await fetchSchulferien("Berlin".replace("Berlin", "Sachsen-Anhalt")), []);
});

test("entries missing a name or dates are dropped, not rendered blank", async () => {
  stubFetch(
    jsonOk([
      { name_cp: "", start: "2026-10-12T00:00Z", end: "2026-10-24T23:59Z" },
      { name_cp: "Winterferien", start: null, end: null },
      entry("Herbstferien", "2026-10-12", "2026-10-24"),
    ])
  );
  const rows = await fetchSchulferien("Mecklenburg-Vorpommern");
  assert.deepEqual(rows.map((r) => r.name), ["Herbstferien"]);
});

test("a failure is not cached: the next call retries", async () => {
  stubFetch(async () => { throw new TypeError("Failed to fetch"); });
  assert.deepEqual(await fetchSchulferien("Schleswig-Holstein"), []);
  stubFetch(jsonOk([entry("Herbstferien", "2026-10-12", "2026-10-24")]));
  const rows = await fetchSchulferien("Schleswig-Holstein");
  assert.deepEqual(rows.map((r) => r.name), ["Herbstferien"]);
});

