// Plain-Node tests for the PKCE helpers, checked against RFC 7636's own
// test vectors. btoa exists in Node 16+; crypto.subtle in Node 18+.
import assert from "node:assert/strict";
import {
  base64UrlEncode,
  generateVerifier,
  challengeFromVerifier,
  randomState,
} from "../public/js/auth/pkce.js";

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

// RFC 7636 Appendix A: base64url of a known octet sequence.
await test("base64UrlEncode: RFC 7636 Appendix A vector", () => {
  const bytes = new Uint8Array([
    116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77,
    105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
  ]);
  assert.equal(base64UrlEncode(bytes), "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
});

// RFC 7636 Appendix B: the canonical verifier -> S256 challenge pair.
await test("challengeFromVerifier: RFC 7636 Appendix B vector", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(await challengeFromVerifier(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

await test("base64UrlEncode: never emits +, / or padding", () => {
  for (let i = 0; i < 200; i++) {
    const encoded = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
    assert.ok(!/[+/=]/.test(encoded), `got unsafe chars in ${encoded}`);
  }
});

await test("generateVerifier: default length and unreserved charset only", () => {
  const verifier = generateVerifier();
  assert.equal(verifier.length, 64);
  assert.ok(/^[A-Za-z0-9\-._~]+$/.test(verifier), `unexpected characters: ${verifier}`);
});

await test("generateVerifier: honours the RFC's 43-128 bounds", () => {
  assert.equal(generateVerifier(43).length, 43);
  assert.equal(generateVerifier(128).length, 128);
  assert.throws(() => generateVerifier(42), /43-128/);
  assert.throws(() => generateVerifier(129), /43-128/);
});

await test("generateVerifier: does not repeat itself", () => {
  const seen = new Set(Array.from({ length: 50 }, () => generateVerifier()));
  assert.equal(seen.size, 50);
});

await test("generateVerifier: no character is disproportionately likely", () => {
  // Rejection sampling should keep the distribution flat; a modulo bias would
  // make the first 40-ish characters of the alphabet noticeably heavier.
  const counts = new Map();
  for (let i = 0; i < 400; i++) {
    for (const ch of generateVerifier(128)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const frequencies = [...counts.values()];
  const expected = (400 * 128) / 64;
  const worst = Math.max(...frequencies.map((f) => Math.abs(f - expected) / expected));
  assert.ok(worst < 0.25, `character distribution skewed by ${(worst * 100).toFixed(1)}%`);
});

await test("randomState: unique and URL-safe", () => {
  const states = Array.from({ length: 50 }, () => randomState());
  assert.equal(new Set(states).size, 50);
  assert.ok(states.every((s) => /^[A-Za-z0-9\-_]+$/.test(s)));
});

console.log(`\n${passed} test(s) passed.`);
if (process.exitCode) console.error("Some tests failed.");
