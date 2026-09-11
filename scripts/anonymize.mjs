// Copies fixtures/raw/*.json -> fixtures/*.json with names, other people's
// ids, and free text replaced by fakes, so the anonymized fixtures can be
// committed (fixtures/raw/ stays gitignored).
//
// This is best-effort, not a privacy guarantee: review fixtures/ by hand
// before committing, especially announcement/note bodies, which are replaced
// with placeholder text but whose *presence* and rough length still leaks
// something about the original.
//
// Usage: node scripts/anonymize.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC_DIR = "fixtures/raw";
const OUT_DIR = "fixtures";

const FIRST_NAMES = ["Alex", "Nils", "Mira", "Finn", "Lea", "Jonas", "Emma", "Timo", "Sara", "Ben"];
const LAST_NAMES = ["Berger", "Hoffmann", "Krause", "Lange", "Vogel", "Weiss", "Schmitt", "Roth"];
const FREE_TEXT_FIELDS = new Set(["body", "text", "content", "message", "note", "comment"]);
const TITLE_FIELDS = new Set(["title", "subject_line", "headline"]);

const nameMap = new Map(); // original string -> fake string
const idMap = new Map(); // original id -> fake id
let nextFakeId = 90001;

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function fakeNameFor(original, pool) {
  if (nameMap.has(original)) return nameMap.get(original);
  const fake = pool[hashString(original) % pool.length];
  nameMap.set(original, fake);
  return fake;
}

function fakeIdFor(original) {
  if (idMap.has(original)) return idMap.get(original);
  const fake = nextFakeId++;
  idMap.set(original, fake);
  return fake;
}

function fakeFreeText(original) {
  if (typeof original !== "string" || original.length === 0) return original;
  const words = Math.max(3, Math.round(original.split(/\s+/).length));
  const lorem = "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore".split(" ");
  return Array.from({ length: words }, (_, i) => lorem[i % lorem.length]).join(" ") + ".";
}

function looksLikePersonObject(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    ("firstname" in obj || "first_name" in obj || "lastname" in obj || "last_name" in obj)
  );
}

function anonymizeValue(key, value, primaryIds) {
  if (value === null || typeof value !== "object") {
    if (key === "email" && typeof value === "string") {
      const fake = fakeNameFor(value, FIRST_NAMES);
      return `${fake.toLowerCase()}@example.invalid`;
    }
    if ((key === "firstname" || key === "first_name") && typeof value === "string") {
      return fakeNameFor(value, FIRST_NAMES);
    }
    if ((key === "lastname" || key === "last_name") && typeof value === "string") {
      return fakeNameFor(value, LAST_NAMES);
    }
    if (key === "name" && typeof value === "string" && value.includes(" ")) {
      return fakeNameFor(value, FIRST_NAMES) + " " + fakeNameFor(value + ":last", LAST_NAMES);
    }
    if (FREE_TEXT_FIELDS.has(key)) return fakeFreeText(value);
    if (TITLE_FIELDS.has(key)) return fakeFreeText(value);
    if (key === "id" && typeof value === "number" && !primaryIds.has(value)) {
      // Only remap ids that belong to person-shaped siblings; handled by caller.
      return value;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => anonymize(item, primaryIds));
  }

  return anonymize(value, primaryIds);
}

function anonymize(obj, primaryIds) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((item) => anonymize(item, primaryIds));

  const isPerson = looksLikePersonObject(obj);
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isPerson && key === "id" && typeof value === "number" && !primaryIds.has(value)) {
      out[key] = fakeIdFor(value);
      continue;
    }
    out[key] = anonymizeValue(key, value, primaryIds);
  }
  return out;
}

function run() {
  mkdirSync(OUT_DIR, { recursive: true });

  let files;
  try {
    files = readdirSync(SRC_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    console.error(`No ${SRC_DIR}/ directory — run scripts/discover.mjs first.`);
    process.exit(1);
  }

  // The logged-in student's own id(s) are left untouched everywhere so the
  // fixtures stay internally consistent (grades.subjectId <-> subjects, etc).
  const primaryIds = new Set();
  try {
    const students = JSON.parse(readFileSync(`${SRC_DIR}/students.json`, "utf8"));
    const list = Array.isArray(students.body?.data) ? students.body.data : [students.body?.data].filter(Boolean);
    for (const s of list) if (typeof s?.id === "number") primaryIds.add(s.id);
  } catch {
    // students.json missing or unexpected shape — proceed without a primary-id allowlist.
  }

  for (const file of files) {
    if (file === "_summary.json") continue;
    const raw = JSON.parse(readFileSync(`${SRC_DIR}/${file}`, "utf8"));
    const anonymized = { ...raw, body: anonymize(raw.body, primaryIds) };
    writeFileSync(`${OUT_DIR}/${file}`, JSON.stringify(anonymized, null, 2));
  }

  console.log(`Anonymized ${files.length} fixture file(s) into ${OUT_DIR}/`);
  console.log("Review them by hand before committing, especially free-text fields.");
}

run();
