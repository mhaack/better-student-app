// OAuth client registration for beste.schule.
//
// Create the client under: Benutzerkonto -> API -> OAuth-Clients, and paste
// its id here. A client id is NOT a secret — with PKCE it's public by design,
// which is why it can live in a committed file. Never put a client *secret*
// here: anything shipped to a browser is readable by everyone.
//
// Leave CLIENT_ID empty to hide the OAuth button and keep the PAT login only.
export const CLIENT_ID = "";

/**
 * Must match a redirect URI registered on the client, exactly. Derived from
 * the current origin so the same build works on localhost and in production —
 * register both (e.g. http://localhost:8080/ and https://<your-domain>/).
 *
 * The app routes on the hash (#/heute), so the bare origin is a usable
 * callback: the code comes back in the query string and nothing needs a
 * server-side rewrite.
 */
export function redirectUri() {
  return `${location.origin}/`;
}

export const AUTHORIZE_URL = "https://beste.schule/oauth/authorize";
export const TOKEN_URL = "https://beste.schule/oauth/token";

export function isOAuthConfigured() {
  return CLIENT_ID.length > 0;
}
