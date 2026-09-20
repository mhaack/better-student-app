// Plain-Node tests for the schulferien-api.de client.
//
// No network: `fetch` is stubbed per case. What matters here is that every
// failure shape resolves to [] rather than rejecting — the Ferien screen has
// to render whether or not a third-party service is reachable.
import assert from "node:assert/strict";

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// The module caches by state code, so each case uses a different state to
// avoid one test's result being served to the next.
const { fetchSchulferien, stateCodeFor } = await import("../public/js/api/schulferien.js");

const realFetch = globalThis.fetch;
function stubFetch(impl) {
  globalThis.fetch = impl;
}
function jsonOk(body) {
  return async () => ({ ok: true, status: 200, json: async () => body });
}

const entry = (name, start, end) => ({
  name_cp: name,
  name: name.toLowerCase(),
  start: `${start}T00:00Z`,
  end: `${end}T23:59Z`,
});

await test("the state-name map covers all 16 Länder", () => {
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

await test("an unknown or missing state yields [] without fetching", async () => {
  let called = false;
  stubFetch(async () => { called = true; });
  assert.deepEqual(await fetchSchulferien("Ruritanien"), []);
  assert.deepEqual(await fetchSchulferien(undefined), []);
  assert.deepEqual(await fetchSchulferien(null), []);
  assert.equal(called, false, "no request should be made without a valid code");
});

await test("an inclusive 23:59Z end date is not rolled forward by the timezone", async () => {
  // The trap this guards: the end is 23:59Z, so reading LOCAL date parts off
  // new Date() lands on the next day at any positive UTC offset — including
  // Europe/Berlin, where this app actually runs. That would silently extend
  // every holiday by a day. Simulated with an explicit timeZone so the
  // assertion holds whatever TZ the test process happens to have.
  const berlin = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  });
  assert.equal(berlin.format(new Date("2027-08-20T23:59Z")), "2027-08-21",
    "precondition: parsing really does roll forward in Berlin");

  stubFetch(jsonOk([entry("Sommerferien", "2027-07-10", "2027-08-20")]));
  const [row] = await fetchSchulferien("Rheinland-Pfalz");
  assert.equal(row.to, "2027-08-20", "the client must keep the date the API meant");
});

await test("entries are normalised to plain dates", async () => {
  stubFetch(jsonOk([entry("Herbstferien", "2026-10-12", "2026-10-24")]));
  const rows = await fetchSchulferien("Bayern");
  assert.deepEqual(rows, [{ name: "Herbstferien", from: "2026-10-12", to: "2026-10-24" }]);
});

await test("the list is cut at the first Sommerferien, inclusive", async () => {
  // `next/365` runs past the end of the school year; the summer break is the
  // natural boundary, so anything after it belongs to the following year.
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

await test("late in the school year, Sommerferien may be the only entry kept", async () => {
  stubFetch(
    jsonOk([
      entry("Sommerferien", "2027-07-10", "2027-08-20"),
      entry("Herbstferien", "2027-10-11", "2027-10-23"),
    ])
  );
  const rows = await fetchSchulferien("Hamburg");
  assert.deepEqual(rows.map((r) => r.name), ["Sommerferien"]);
});

await test("a response with no Sommerferien is kept whole", async () => {
  stubFetch(jsonOk([entry("Herbstferien", "2026-10-12", "2026-10-24")]));
  const rows = await fetchSchulferien("Bremen");
  assert.equal(rows.length, 1);
});

await test("entries arrive sorted by start date", async () => {
  stubFetch(
    jsonOk([
      entry("Winterferien", "2027-02-08", "2027-02-19"),
      entry("Herbstferien", "2026-10-12", "2026-10-24"),
    ])
  );
  const rows = await fetchSchulferien("Hessen");
  assert.deepEqual(rows.map((r) => r.from), ["2026-10-12", "2027-02-08"]);
});

await test("a 500 resolves to [] rather than rejecting", async () => {
  // The real service already does this for year 2029.
  stubFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  assert.deepEqual(await fetchSchulferien("Saarland"), []);
});

await test("a 404 resolves to []", async () => {
  stubFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  assert.deepEqual(await fetchSchulferien("Thüringen"), []);
});

await test("a network failure resolves to []", async () => {
  stubFetch(async () => { throw new TypeError("Failed to fetch"); });
  assert.deepEqual(await fetchSchulferien("Brandenburg"), []);
});

await test("malformed JSON resolves to []", async () => {
  stubFetch(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } }));
  assert.deepEqual(await fetchSchulferien("Niedersachsen"), []);
});

await test("an unexpected body shape resolves to []", async () => {
  stubFetch(jsonOk({ unexpected: true }));
  assert.deepEqual(await fetchSchulferien("Berlin".replace("Berlin", "Sachsen-Anhalt")), []);
});

await test("entries missing a name or dates are dropped, not rendered blank", async () => {
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

globalThis.fetch = realFetch;
console.log(`\n${passed} passed`);
