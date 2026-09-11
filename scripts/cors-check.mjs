// Checks whether beste.schule sends CORS headers on preflight (OPTIONS)
// requests for a foreign Origin. Node's fetch doesn't enforce CORS itself
// (that's a browser thing), so this just inspects the response headers the
// server sends back — which is exactly what a real browser preflight would see.
//
// Usage: node scripts/cors-check.mjs
const ORIGIN = "https://example.com";

const BASE = "https://beste.schule";
const checks = [
  { url: `${BASE}/api/students`, method: "GET" },
  { url: `${BASE}/api/announcements`, method: "POST" },
  { url: `${BASE}/oauth/token`, method: "POST" },
];

const RELEVANT_HEADERS = [
  "access-control-allow-origin",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-allow-credentials",
  "access-control-max-age",
];

async function checkOne({ url, method }) {
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": "authorization,content-type,accept",
    },
  });

  const headers = {};
  for (const name of RELEVANT_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers[name] = value;
  }

  return { url, method, status: res.status, headers };
}

async function run() {
  console.log(`Preflight checks with Origin: ${ORIGIN}\n`);
  for (const check of checks) {
    const result = await checkOne(check);
    console.log(`OPTIONS ${result.url}  (for ${result.method})`);
    console.log(`  status: ${result.status}`);
    if (Object.keys(result.headers).length === 0) {
      console.log("  no Access-Control-* headers in the response — preflight would fail in a browser");
    } else {
      for (const [k, v] of Object.entries(result.headers)) {
        console.log(`  ${k}: ${v}`);
      }
    }
    console.log("");
  }
}

run().catch((err) => {
  console.error("CORS check failed:", err);
  process.exit(1);
});
