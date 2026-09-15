// Holds the beste.schule credentials and the resolved student list.
//
// Two kinds of session live here behind one interface, so everything above
// this layer only ever asks for "the token":
//   - "pat": a Personal Access Token the user pasted. Never expires.
//   - "oauth": an access token from the PKCE flow, with a refresh token and
//     an expiry. js/api/client.js refreshes it when the API says 401.
//
// "Angemeldet bleiben" unchecked (default): sessionStorage, gone when the tab
// closes. Checked: localStorage, persists across restarts. Never both at once.
const TOKEN_KEY = "schulblick.token";
// Kept separate from TOKEN_KEY so sessions predating OAuth keep working.
const SESSION_KEY = "schulblick.session";
const STUDENTS_KEY = "schulblick.students";
const SELECTED_STUDENT_KEY = "schulblick.selectedStudentId";

let memoryToken = null;
const listeners = new Set();

function storageFor(remember) {
  return remember ? window.localStorage : window.sessionStorage;
}

function readFromEitherStorage(key) {
  try {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getToken() {
  if (memoryToken) return memoryToken;
  memoryToken = readFromEitherStorage(TOKEN_KEY);
  return memoryToken;
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function setToken(token, remember) {
  memoryToken = token;
  const store = storageFor(remember);
  const other = storageFor(!remember);
  store.setItem(TOKEN_KEY, token);
  try {
    other.removeItem(TOKEN_KEY);
    // A PAT has no refresh token or expiry. Drop any OAuth metadata left by a
    // previous session, or the client would try to refresh a PAT on a 401.
    store.removeItem(SESSION_KEY);
    other.removeItem(SESSION_KEY);
  } catch {
    // ignore storage access issues (private browsing etc.)
  }
  // No notify() here: login.js validates the token (fetchStudents) before
  // navigating itself. Firing the global auth-change listener this early
  // would send the app into the authenticated shell before a student id is
  // selected. onAuthChange only needs to fire for *losing* a session.
}

/**
 * Stores an OAuth session. `expiresIn` is the API's seconds-from-now; it's
 * converted to an absolute timestamp because a duration stops being true the
 * moment it's written to storage.
 */
export function setOAuthSession({ accessToken, refreshToken, expiresIn }, remember) {
  memoryToken = accessToken;
  const store = storageFor(remember);
  const other = storageFor(!remember);
  store.setItem(TOKEN_KEY, accessToken);
  store.setItem(
    SESSION_KEY,
    JSON.stringify({
      kind: "oauth",
      refreshToken: refreshToken ?? null,
      expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
    })
  );
  try {
    other.removeItem(TOKEN_KEY);
    other.removeItem(SESSION_KEY);
  } catch {
    // ignore storage access issues (private browsing etc.)
  }
}

function readSession() {
  const raw = readFromEitherStorage(SESSION_KEY);
  if (!raw) return { kind: "pat", refreshToken: null, expiresAt: null };
  try {
    return JSON.parse(raw);
  } catch {
    return { kind: "pat", refreshToken: null, expiresAt: null };
  }
}

/** "oauth" once the PKCE flow has run, otherwise "pat". */
export function getSessionKind() {
  return readSession().kind;
}

export function getRefreshToken() {
  return readSession().refreshToken;
}

export function clearSession() {
  memoryToken = null;
  for (const key of [TOKEN_KEY, SESSION_KEY, STUDENTS_KEY, SELECTED_STUDENT_KEY]) {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  notify();
}

/** Which storage the current session chose, so later writes stay consistent. */
export function isRemembered() {
  try {
    return Boolean(window.localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

export function setStudents(students) {
  const remember = Boolean(window.localStorage.getItem(TOKEN_KEY));
  storageFor(remember).setItem(STUDENTS_KEY, JSON.stringify(students));
}

export function getStudents() {
  const raw = readFromEitherStorage(STUDENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function setSelectedStudentId(id) {
  const remember = Boolean(window.localStorage.getItem(TOKEN_KEY));
  storageFor(remember).setItem(SELECTED_STUDENT_KEY, String(id));
}

export function getSelectedStudentId() {
  const raw = readFromEitherStorage(SELECTED_STUDENT_KEY);
  return raw ? Number(raw) : null;
}

export function onAuthChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}
