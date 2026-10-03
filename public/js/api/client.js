// Thin fetch wrapper around https://beste.schule/api (Laravel conventions:
// `filter[x]`/`include`/`per_page` params, `{ data, meta }` pagination).
import { getToken, clearSession, getSessionKind } from "../state/auth-store.js";
import { refreshAccessToken } from "../auth/oauth.js";

const BASE_URL = "https://beste.schule/api";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const MAX_PAGES = 50;

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class AuthError extends ApiError {
  constructor(message, status, body) {
    super(message, status, body);
    this.name = "AuthError";
  }
}

function buildUrl(path, params) {
  const url = new URL(`${BASE_URL}/${path.replace(/^\//, "")}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
    }
  }
  return url.toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} path e.g. "grades" or "finalgrades/123"
 * @param {{ params?: Record<string, string|number|Array<string|number>>, method?: string, body?: unknown, signal?: AbortSignal }} [options]
 */
export async function apiFetch(path, options = {}) {
  const { params, method = "GET", body, signal } = options;
  const url = buildUrl(path, params);

  let lastError;
  // One refresh per call; a second 401 means the session is gone.
  let refreshAttempted = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener("abort", onExternalAbort);

    try {
      const token = getToken();
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401 || res.status === 403) {
        const errBody = await safeJson(res);

        if (res.status === 401 && !refreshAttempted && getSessionKind() === "oauth") {
          refreshAttempted = true;
          // Not counted as a retry.
          attempt -= 1;
          if (await refreshAccessToken()) continue;
        }

        if (res.status === 401) clearSession();
        throw new AuthError(`beste.schule API auth error (${res.status})`, res.status, errBody);
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 500);
          continue;
        }
      }

      const responseBody = await safeJson(res);

      if (!res.ok) {
        throw new ApiError(`beste.schule API error (${res.status}) for ${path}`, res.status, responseBody);
      }

      return responseBody;
    } catch (err) {
      if (err instanceof AuthError || err instanceof ApiError) throw err;
      lastError = err;
      if (attempt < MAX_RETRIES && err.name !== "AbortError") {
        await sleep(2 ** attempt * 500);
        continue;
      }
      if (err.name === "AbortError") {
        throw new ApiError(`Request to ${path} timed out or was cancelled`, 0);
      }
      throw new ApiError(`Network error calling ${path}: ${err.message}`, 0);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }
  throw lastError ?? new ApiError(`Failed to call ${path}`, 0);
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Fetches every page of a collection route and returns the combined `data`. */
export async function apiFetchAll(path, options = {}) {
  const perPage = options.params?.per_page ?? 250;
  const all = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await apiFetch(path, {
      ...options,
      params: { ...options.params, per_page: perPage, page },
    });
    const data = Array.isArray(response?.data) ? response.data : [];
    all.push(...data);

    // Count our own page, not the response's: a stale current_page would
    // loop forever.
    const lastPage = response?.meta?.last_page;
    if (!lastPage || page >= lastPage) break;
  }

  return all;
}
