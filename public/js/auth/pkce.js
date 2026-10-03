// PKCE (RFC 7636) helpers, tested against the RFC's test vectors.

const UNRESERVED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/** base64url per RFC 4648 §5: URL-safe alphabet, no padding. */
export function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A 43-128 character verifier (RFC 7636 §4.1). Rejection sampling, since
 * `% UNRESERVED.length` would bias it.
 */
export function generateVerifier(length = 64) {
  if (length < 43 || length > 128) throw new Error("code_verifier must be 43-128 characters");
  const max = Math.floor(256 / UNRESERVED.length) * UNRESERVED.length;
  let out = "";
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of bytes) {
      if (out.length === length) break;
      if (byte < max) out += UNRESERVED[byte % UNRESERVED.length];
    }
  }
  return out;
}

/** S256 challenge: base64url(SHA-256(ASCII(verifier))). */
export async function challengeFromVerifier(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Opaque value tying the callback back to the request that started it (CSRF). */
export function randomState() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
}
