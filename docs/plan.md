# beste.schule Student App — Implementation Plan (v2, client-only)

Working title: **Schulblick**
Goal: a static, client-only PWA where a student logs in with their beste.schule account and sees grades, timetable, substitutions, homework, absences and announcements. No backend: the browser talks directly to `beste.schule/api`.

**Project decisions (this build):**
- Design: the **hybrid direction (2a)** from `project/Schulblick Layoutrichtungen.dc.html` only — not 1a/1b/1c.
- Stack: **plain HTML/CSS/JS**, no build step, no framework (deviates from this plan's React/Vite suggestion below — kept for the architecture/data-model reasoning, adapted to vanilla JS in the app itself).
- Data: real beste.schule API, Personal Access Token auth for now.
- Scope: the 5 designed screens (Heute, Noten Sek I, Noten Oberstufe, Fach-Detail Sek I, Fach-Detail Oberstufe) + stub Stundenplan/Mehr tabs.

**What changed in v2:** CORS confirmed for `/api` (authenticated GET from a foreign origin works, so the preflight passes). Next.js/BFF dropped in favour of a static PWA. Oberstufe (points 0–15, LK/GK, Kurshalbjahre) added to the data model and screens. Server-side push dropped from scope.

---

## 1. API findings

| Topic | Finding |
|---|---|
| Base URL | `https://beste.schule/api` |
| Headers | `Accept: application/json` (required), `Content-Type: application/json` for bodies, `Authorization: Bearer <token>` |
| CORS | **Confirmed** for authenticated GET on `/api/*` from a foreign origin |
| Route pattern | Laravel resource style: `GET /{entities}`, `GET /{entities}/{id}` |
| Auth option A | OAuth 2 Authorization Code: `/oauth/authorize`, `/oauth/join` (unregistered users), `/oauth/token`. Client created under *Benutzerkonto → API → OAuth-Clients* |
| Auth option B | Personal Access Token (same page). Equivalent to the user's password |
| Scopes | None. Permissions = role of the logged-in user (higher roles inherit lower ones, so guardian accounts work too) |
| Query params | `filter[student|guardian|group|subject|interval|year|teacher]=id[,id]`, `filter[range]=YYYY-MM-DD,YYYY-MM-DD`, `include=a,b.c`, `sort=field`, `per_page=n` |
| Response shape | `{ data: [...], meta: {...} }` (paginated) or `{ data: {...} }` |
| Naming | group = Klasse, interval = Halbjahr, level = Jahrgang, guardian = Elternteil, subject = Fach, finalgrade = Endnote, journal = Klassenbuch, year = Schuljahr |

### Still open (resolve in Phase 0)

**Phase 0 is done — see `docs/api-notes.md` for what the live API actually
returns.** Resolved there: the "me" route and user↔student link, grade value
formats and collection types, how Oberstufe/Kurshalbjahre are represented
(interval `type`), and how LK/GK is (not) exposed. Still open:

1. **CORS on `/oauth/token`.** Laravel's default CORS config only covers
   `api/*`, so `/oauth/*` may not send CORS headers even though `/api` does.
   This decides whether OAuth works without any server.
2. **Public OAuth clients + PKCE.** The docs say a secret is given only
   "gegebenenfalls", which suggests secret-less public clients exist. Confirm
   by creating a client.
3. CORS on write routes used by students (announcement/notification
   mark-read, POST/PUT).
4. Access-token lifetime, refresh tokens, rate limits.
5. Terms of use for third-party clients: ask schulverwalter.online before
   going public.

---

## 2. Student-accessible endpoints → features

| Feature | Endpoint(s) | Useful params |
|---|---|---|
| Profile / identity | `me`, `students`, `students/{id}` | `include=groups` |
| School header + logo | `school`, school logo route | — |
| Years / half-years | `years`, `intervals` | `filter[year]` |
| Groups / courses | `groups` | `filter[student]`, `include=students,subjects` |
| Subjects | `subjects` | `filter[student]` |
| Grades | `grades`, `collections` | `filter[student]`, `filter[year]`, `include=collection,subject,teacher`, `per_page=250` |
| Final grades + averages | `finalgrades`, `finalgrades/{id}` (`calculation_rule`, `calculation_for`, `interval_id`) | `filter[student]`, `filter[year]` |
| Timetable | `time-tables/current` | `include=lessons.times` |
| Substitutions | `substitution-plans/days`, `substitution-plans/lessons` | `filter[range]`, `include=lessons,subject,teachers,rooms,notes` |
| Homework / lesson notes | `journal/lessons`, `journal/weeks` | `filter[student]`, `filter[range]`, `include=notes.type,subject` |
| Attendance / absences | `journal/day-student`, `journal/lesson-student`, `absences`, `absence-batches` | `filter[student]` |
| Announcements | `announcements` (+ mark-read) | — |
| Notifications | `notifications` (+ markRead) | — |
| Notes / checklists | `notes`, `checklists` | `filter[student]` |

Everything is read-only for students except their own account and read-state of announcements/notifications.

---

## 3. Data model (normalized, in the browser)

A single data-layer module maps raw responses to stable shapes, so API quirks stay in one place. (This build uses plain JS + JSDoc typedefs instead of TypeScript `type` aliases — the shapes below are the contract either way.)

```
Student   = { id, firstName, lastName, groups: GroupRef[], schoolName, stage: 'sek1' | 'oberstufe' }
Year      = { id, name, from, to, intervals: Interval[] }
Interval  = { id, name, from, to }                          // Halbjahr or Kurshalbjahr (11/I …)
Subject   = { id, name, short?, teacher?, courseType?: 'LK' | 'GK' }

GradeScale = 'grade_1_6' | 'points_0_15'
GradeCollection = { id, type, name?, weighting, givenAt, subjectId, intervalId }
Grade     = { id, raw, numeric: number|null, scale: GradeScale, collection, subjectId, givenAt, teacher? }

SubjectAverage = {
  subjectId, intervalId,
  value: number|null, scale: GradeScale,
  source: 'api_value' | 'api_formula' | 'estimated' | 'unavailable',
  formula?, variables?,
  unterkurs?: boolean                                        // Oberstufe: value < 5 points
}

Lesson    = { date, period, start, end, subject, room?, teacher?,
              status: 'regular' | 'substitution' | 'room_change' | 'cancelled', note? }
Homework  = { id, lessonDate, subject, text, due? }
Absence   = { id, from, to, excused: boolean|null, type? }
Announcement = { id, title, body, createdAt, read }
```

**Grade parsing:** Sek I `"2+" → 1.75`, `"2-" → 2.25` (offset configurable), `"1,5" → 1.5`. Oberstufe points `0–15` stay points. Never mix scales in one average; never convert silently. An optional "≈ Note" display (12 P ≈ 2+) is presentation only.

**Averages:** use the school's `calculation_rule` from `finalgrades/{id}` when `calculation_for === 'student'`; otherwise a weighted mean from collection weightings, labelled **"geschätzt"**. Valid range depends on scale (1–6 or 0–15).

---

## 4. Architecture

```
[Static app in the browser] ──Bearer token──▶ [beste.schule/api]
   │  data layer (fetch + mappers + grade logic)
   │  in-memory cache + IndexedDB persistence (offline, "neu seit")
   └─ served as static files from any host
```

- No server code. The host only serves HTML/JS/CSS.
- All aggregation (parallel calls, merging substitutions into the timetable, averages) runs client-side.
- You never receive tokens or grade data, which keeps the privacy footprint small.

**Stack (as built):**
- Plain HTML/CSS/JS, ES modules, no bundler.
- Hand-rolled hash-based router + view mount functions instead of a framework.
- A small fetch-based query cache (stale-while-revalidate, in-memory) instead of TanStack Query; persisted to IndexedDB per student for offline/"neu seit".
- No Zod — plain runtime checks + JSDoc typedefs for editor support.
- A hand-written `manifest.json` + `sw.js` for PWA install and app-shell caching.
- **Hosting:** Cloudflare Pages. The deployable app lives in `public/` (everything else — `docs/`, `scripts/`, `fixtures/` — stays out of the published output); point Pages' build output directory at `public/`, no build command. `public/_headers` sets the CSP (see its own comments for the `style-src 'unsafe-inline'` tradeoff the inline-style-attribute approach requires).

**Fallback if `/oauth/token` lacks CORS:** a Cloudflare Worker (~30 lines) that forwards only the token exchange and adds CORS headers. It stores nothing and never sees API data. Everything else stays client-only.

---

## 5. Auth

**Now (MVP): Personal Access Token.**
- Login screen with a token field and a short in-app guide: *Benutzerkonto → API → Personal Access Token erstellen*.
- Validate with `GET me`/`students`, then resolve the student(s). If more than one (guardian account), show a switcher.

**Later: OAuth Authorization Code + PKCE (public client, no secret)**, if Phase 0 confirms public clients and CORS on `/oauth/token`.
1. Generate `code_verifier`/`code_challenge` + `state` in the browser, redirect to `/oauth/authorize`.
2. Callback route in the SPA verifies `state`, POSTs the code + verifier to `/oauth/token`.
3. Keep tokens in memory; refresh if refresh tokens are issued.

**Token storage:**
- Default: memory + `sessionStorage` (gone when the tab closes).
- Opt-in "Angemeldet bleiben": `localStorage`, with a clear note on the login screen.
- The real protection against token theft is a clean frontend: no third-party scripts, strict CSP, no raw-HTML injection of API text (announcements, notes).
- Logout clears storage and the IndexedDB cache.

---

## 6. Privacy & security

- Grade data only ever lives in the student's browser (memory + IndexedDB cache). Nothing is sent to you.
- No analytics, no third-party scripts. Self-host fonts (hardening phase; MVP may still use Google Fonts to match the mockup — swap before shipping).
- CSP: `default-src 'self'; connect-src 'self' https://beste.schule; img-src 'self' https://beste.schule data:; frame-ancestors 'none'` (adjust after Phase 0).
- If public: Impressum, short privacy page (the host still logs IPs), and an "inoffizielle App" disclaimer. Still get an OK from schulverwalter.online.

---

## 7. Phases

| Phase | Scope | Done when |
|---|---|---|
| **0 · Spike** | PAT discovery script, anonymized fixtures, schemas, answers to §1 open questions (especially `/oauth/token` CORS and PKCE) | `fixtures/` + `docs/api-notes.md` exist; OAuth path decided |
| **1 · MVP** | Static scaffold, PAT login, data layer, **Heute**, **Noten** + **Fach-Detail** (Sek I and Oberstufe), stub **Stundenplan**/**Mehr** | You use it daily instead of the official app |
| **2 · Complete** | Homework, absences, announcements/notifications (+ mark read), profile, year/interval switcher, multi-student switcher, PWA install, offline cache | Feature parity for everything a student can read |
| **3 · "Neu seit"** | Local change tracking: highlight new grades/substitutions/announcements since last visit; app badge; optional Periodic Background Sync (Chromium, installed PWA only, best effort) | Opening the app shows what changed at a glance |
| **4 · OAuth, polish & ship** | OAuth PKCE (or token relay), accessibility, dark mode, E2E tests, CSP headers, deploy, privacy docs | Public URL + privacy page |

Out of scope: server-side push notifications. Revisit only if "Neu seit" isn't enough in daily use; that would add a server and bring back the data-controller obligations.

---

## 8. Screens

1. **Heute**: substitution banner/card, next lessons (regular/changed/cancelled), newest grades, homework due soon.
2. **Noten**: overall average + per-subject averages for the selected (Kurs-)Halbjahr. Sek I in Noten, Oberstufe in Punkten with LK/GK grouping and Unterkurs counter, mini-trend per subject. "Formel der Schule" vs "geschätzt".
3. **Fach-Detail**: grades by collection type with weighting, trend chart (direction-aware per scale), expandable "So wird gerechnet" formula explanation.
4. **Stundenplan** (stub in this build): nav tab present, placeholder screen.
5. **Mehr** (stub in this build): nav tab present, placeholder screen.

---

## 9. Status of this build

See root task list for live progress. Diverges from the original follow-up-prompt sequence below in stack (plain JS, not React/Vite) and scope (hybrid-2a only, Stundenplan/Mehr stubbed) per explicit decisions above; the phase structure and API/data-model reasoning still apply.
