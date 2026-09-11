// Phase 0 API discovery spike.
//
// Calls the beste.schule API routes a student account can read and saves each
// raw response under fixtures/raw/<route>.json, so docs/api-notes.md and the
// Zod-free JSDoc schemas in js/api/schemas.js can be written from real shapes
// instead of guesses.
//
// Usage: add BESTE_SCHULE_TOKEN=... to .env (a beste.schule Personal Access
// Token, from Benutzerkonto -> API -> Personal Access Token erstellen), then:
//   node scripts/discover.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "./lib/env.mjs";

loadEnv();

const BASE = "https://beste.schule/api";
const TOKEN = process.env.BESTE_SCHULE_TOKEN;

if (!TOKEN) {
  console.error(
    "Missing BESTE_SCHULE_TOKEN. Add it to .env (see scripts/discover.mjs header) and re-run."
  );
  process.exit(1);
}

const OUT_DIR = "fixtures/raw";
mkdirSync(OUT_DIR, { recursive: true });

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function slugify(route) {
  return (
    route
      .replace(/^\//, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "root"
  );
}

async function getJson(route) {
  const url = `${BASE}/${route.replace(/^\//, "")}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
  });
  const status = res.status;
  let body = null;
  let parseError = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch (err) {
    parseError = err.message;
    body = text;
  }
  return { status, body, parseError };
}

async function run() {
  // Resolve the student id(s) first so id-dependent routes below can use them.
  const studentsResult = await getJson("students");
  save("students", studentsResult);

  const students = Array.isArray(studentsResult.body?.data)
    ? studentsResult.body.data
    : studentsResult.body?.data
      ? [studentsResult.body.data]
      : [];
  const studentId = students[0]?.id;

  if (!studentId) {
    console.warn(
      "Could not determine a student id from GET /students — id-dependent routes below will be skipped or may 403."
    );
  }

  const routes = [
    "me",
    "user",
    "school",
    "years",
    "intervals",
    "subjects",
    "groups?include=students,subjects",
    "grades?include=collection,subject,teacher&per_page=250",
    "collections",
    "finalgrades?per_page=250",
    "time-tables/current?include=lessons.times",
    `substitution-plans/days?filter[range]=${today(-7)},${today(30)}&include=lessons,subject,teachers,rooms,notes`,
    "absences",
    "announcements",
    "notifications",
    "notes",
    "checklists",
  ];

  if (studentId) {
    routes.push(
      `journal/weeks?filter[student]=${studentId}`,
      `journal/lessons?filter[student]=${studentId}&filter[range]=${today(0)},${today(21)}&include=notes.type`,
      `journal/day-student?filter[student]=${studentId}`,
      `journal/lesson-student?filter[student]=${studentId}`
    );
  }

  const results = { students: statusOf(studentsResult) };

  for (const route of routes) {
    const result = await getJson(route);
    save(route, result);
    results[route] = statusOf(result);
  }

  // finalgrades/{id} needs a real finalgrade id from the finalgrades list above.
  const finalgradesRoute = routes.find((r) => r.startsWith("finalgrades?"));
  const finalgradesResult = finalgradesRoute ? await reread(finalgradesRoute) : null;
  const firstFinalgradeId = Array.isArray(finalgradesResult?.data)
    ? finalgradesResult.data[0]?.id
    : undefined;
  if (firstFinalgradeId) {
    const route = `finalgrades/${firstFinalgradeId}`;
    const result = await getJson(route);
    save(route, result);
    results[route] = statusOf(result);
  }

  writeFileSync(
    `${OUT_DIR}/_summary.json`,
    JSON.stringify(results, null, 2)
  );

  console.log("\nRoute status summary:");
  for (const [route, status] of Object.entries(results)) {
    console.log(`  ${String(status).padEnd(20)} ${route}`);
  }
  console.log(`\nSaved raw responses to ${OUT_DIR}/`);

  function save(route, result) {
    const file = `${OUT_DIR}/${slugify(route)}.json`;
    writeFileSync(
      file,
      JSON.stringify({ route, status: result.status, body: result.body }, null, 2)
    );
  }

  async function reread(route) {
    // Cheap re-fetch instead of threading the first result through — discovery
    // scripts run once, clarity over micro-optimization.
    const r = await getJson(route);
    return r.body;
  }

  function statusOf(result) {
    return result.parseError ? `${result.status} (non-JSON)` : result.status;
  }
}

run().catch((err) => {
  console.error("Discovery failed:", err);
  process.exit(1);
});
