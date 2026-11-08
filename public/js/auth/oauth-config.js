// OAuth client (Benutzerkonto -> API -> OAuth-Clients). The id is public with
// PKCE; never put a client *secret* here, every visitor can read this file.
// An empty CLIENT_ID hides the OAuth button.
export const CLIENT_ID = "236";

export const AUTHORIZE_URL = "https://beste.schule/oauth/authorize";
export const TOKEN_URL = "https://beste.schule/oauth/token";

/**
 * Must exactly match a registered redirect URI; register both localhost and
 * production. The bare origin works since routing uses the hash.
 */
export function redirectUri() {
  return `${location.origin}/`;
}

export function isOAuthConfigured() {
  return CLIENT_ID.length > 0;
}
