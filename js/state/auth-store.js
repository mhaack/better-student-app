// Holds the beste.schule Personal Access Token and the resolved student list.
//
// "Angemeldet bleiben" unchecked (default): sessionStorage, gone when the tab
// closes. Checked: localStorage, persists across restarts. Never both at once.
const TOKEN_KEY = "schulblick.token";
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
  } catch {
    // ignore storage access issues (private browsing etc.)
  }
  // No notify() here: login.js validates the token (fetchStudents) before
  // navigating itself. Firing the global auth-change listener this early
  // would send the app into the authenticated shell before a student id is
  // selected. onAuthChange only needs to fire for *losing* a session.
}

export function clearSession() {
  memoryToken = null;
  for (const key of [TOKEN_KEY, STUDENTS_KEY, SELECTED_STUDENT_KEY]) {
    try {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
  notify();
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
