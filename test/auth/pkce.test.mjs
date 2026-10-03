// PKCE helpers against RFC 7636's test vectors.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  base64UrlEncode,
  generateVerifier,
  challengeFromVerifier,
  randomState,
} from "../../public/js/auth/pkce.js";

describe("base64UrlEncode", () => {
  test("encodes the RFC 7636 Appendix A vector", () => {
    const bytes = new Uint8Array([
      116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77,
      105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
    ]);
    assert.equal(base64UrlEncode(bytes), "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
  });

  test("never emits +, / or padding", () => {
    for (let i = 0; i < 200; i++) {
      const encoded = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
      assert.ok(!/[+/=]/.test(encoded), `got unsafe chars in ${encoded}`);
    }
  });
});

describe("challengeFromVerifier", () => {
  test("matches the RFC 7636 Appendix B verifier/challenge pair", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    assert.equal(await challengeFromVerifier(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("generateVerifier", () => {
  test("default length and unreserved charset only", () => {
    const verifier = generateVerifier();
    assert.equal(verifier.length, 64);
    assert.ok(/^[A-Za-z0-9\-._~]+$/.test(verifier), `unexpected characters: ${verifier}`);
  });

  test("honours the RFC's 43-128 bounds", () => {
    assert.equal(generateVerifier(43).length, 43);
    assert.equal(generateVerifier(128).length, 128);
    assert.throws(() => generateVerifier(42), /43-128/);
    assert.throws(() => generateVerifier(129), /43-128/);
  });

  test("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateVerifier()));
    assert.equal(seen.size, 50);
  });

  test("no character is disproportionately likely", () => {
    // A modulo bias would make the first ~40 characters heavier.
    const counts = new Map();
    for (let i = 0; i < 400; i++) {
      for (const ch of generateVerifier(128)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    const frequencies = [...counts.values()];
    const expected = (400 * 128) / 64;
    const worst = Math.max(...frequencies.map((f) => Math.abs(f - expected) / expected));
    assert.ok(worst < 0.25, `character distribution skewed by ${(worst * 100).toFixed(1)}%`);
  });
});

describe("randomState", () => {
  test("unique and URL-safe", () => {
    const states = Array.from({ length: 50 }, () => randomState());
    assert.equal(new Set(states).size, 50);
    assert.ok(states.every((s) => /^[A-Za-z0-9\-_]+$/.test(s)));
  });
});
