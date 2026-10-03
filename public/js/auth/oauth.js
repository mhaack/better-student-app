// Authorization Code flow with PKCE, entirely in the browser: /oauth/token
// sends CORS headers, so no server is needed.
import { generateVerifier, challengeFromVerifier, randomState } from "./pkce.js";
import { CLIENT_ID, AUTHORIZE_URL, TOKEN_URL, redirectUri } from "./oauth-config.js";
import { setOAuthSession, getRefreshToken, isRemembered } from "../state/auth-store.js";

// Survives the redirect but not the attempt: always sessionStorage.
const PENDING_KEY = "schulblick.oauth.pending";

export class OAuthError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "OAuthError";
    this.cause = cause;
  }
}

/** Starts the flow and redirects; the returned promise never resolves. */
export async function beginLogin({ remember = false } = {}) {
  const verifier = generateVerifier();
  const state = randomState();
  const challenge = await challengeFromVerifier(verifier);

  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, remember }));

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);

  location.assign(url.toString());
  return new Promise(() => {});
}

/** True when the current URL looks like a redirect back from beste.schule. */
export function isCallback(search = location.search) {
  const params = new URLSearchParams(search);
  return params.has("code") || params.has("error");
}

/**
 * Completes the flow from the callback URL. Always strips the query string so
 * a reload can't replay the code.
 */
export async function completeLogin(search = location.search) {
  const params = new URLSearchParams(search);
  const pendingRaw = sessionStorage.getItem(PENDING_KEY);
  sessionStorage.removeItem(PENDING_KEY);
  stripCallbackFromUrl();

  const error = params.get("error");
  if (error) {
    throw new OAuthError(
      error === "access_denied"
        ? "Die Anmeldung wurde abgebrochen."
        : `beste.schule hat die Anmeldung abgelehnt (${error}).`
    );
  }

  const code = params.get("code");
  if (!code) throw new OAuthError("Die Antwort von beste.schule enthielt keinen Code.");
  if (!pendingRaw) {
    throw new OAuthError("Zu dieser Anmeldung gibt es keinen offenen Vorgang. Bitte erneut anmelden.");
  }

  const pending = JSON.parse(pendingRaw);
  // Single-use and tab-local, so no constant-time compare needed.
  if (!params.get("state") || params.get("state") !== pending.state) {
    throw new OAuthError("Die Anmeldung konnte nicht zugeordnet werden. Bitte erneut versuchen.");
  }

  const tokens = await postToken({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    code,
    code_verifier: pending.verifier,
  });

  setOAuthSession(tokens, pending.remember);
  return { remember: pending.remember };
}

/**
 * Refreshes the access token. Single-flight: parallel 401s share one
 * refresh, as each refresh invalidates the previous token.
 */
let inFlightRefresh = null;

export function refreshAccessToken() {
  if (inFlightRefresh) return inFlightRefresh;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);

  inFlightRefresh = postToken({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  })
    .then((tokens) => {
      setOAuthSession(tokens, isRemembered());
      return true;
    })
    .catch(() => false)
    .finally(() => {
      inFlightRefresh = null;
    });

  return inFlightRefresh;
}

async function postToken(body) {
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new OAuthError("beste.schule war nicht erreichbar.", err);
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new OAuthError(
      payload?.error_description || payload?.error || `Token-Anfrage fehlgeschlagen (${res.status}).`
    );
  }
  if (!payload?.access_token) throw new OAuthError("Die Antwort enthielt kein Token.");

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresIn: payload.expires_in ?? null,
  };
}

function stripCallbackFromUrl() {
  history.replaceState(null, "", location.pathname + location.hash);
}
