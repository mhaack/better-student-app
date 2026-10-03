# CLAUDE.md

Unofficial, client-only PWA for beste.schule. Plain HTML/CSS/JS ES modules —
no build step, no framework, no runtime dependencies. `public/` is the whole
deployed app (Cloudflare Pages). See `README.md` for the full picture.

## Commands

- `npm test` — runs every `test/**/*.test.mjs` with Node's built-in runner
  (`node:test` + `node:assert/strict`, no dependencies). Must end with
  `# fail 0` and exit 0. CI runs the same on every PR.
- `npm run test:watch` / `npm run test:coverage` — rerun on change / coverage
  of `public/`. Mock with `mock` from `node:test` (e.g. `mock.method(globalThis,
  "fetch", …)`, `mock.timers` for dates) instead of reassigning globals.
- `npm run lint` — Biome's recommended rules over `public/`, `scripts/` and
  `test/` (run `npm ci` once; Biome is the only dev dependency). CI runs it
  before the tests. Fix the finding rather than disabling the rule; a rule
  that's wrong for this codebase gets turned off in `biome.json` with a reason.
- `npm run serve` — static server on `http://localhost:8080`.

## Where things go

```
api/mappers.js   raw API JSON → flat lesson/grade objects (no logic beyond shape)
data/            merging and deciding: plan vs. timetable, averages, statuses
domain/          pure functions, unit-tested
views/           rendering only — reads the fields data/ prepared
```

API quirks are handled in `data/`, never patched over in a view. If a view
needs to "fix" what it displays, the data layer is wrong.

## The API lies in known ways — read first

`docs/api-notes.md` records what beste.schule actually returns. Read it before
touching `api/` or `data/`; add to it when you find something new. The ones
most likely to bite:

- A changed plan lesson lists the **original and the new** rooms/teachers in
  the same array. The new one is the set difference against the timetable
  (`diffList` in `data/timetable.js`). Reuse it — don't compare joined strings.
- `name` on a person is the surname.
- A double period repeats the same Klassenbuch note once per lesson.

## How we work

- **Start from current main.** Merge `origin/main` into your branch before
  changing anything; a fix may already have landed there.
- **Every real bug gets a test first.** When a bug comes from real data (a
  screenshot, a phone report), reproduce it as a case in the matching test
  file, with names/rooms like the real ones but no student data, and see it
  fail before fixing it.
- **Tests mirror the source.** `public/js/<layer>/<module>.js` is tested in
  `test/<layer>/<module>.test.mjs`, one `describe("<function>")` per exported
  function, test titles describing the behaviour ("skips a named single
  Feiertag"). Fixtures shared across files go in `test/support/`.
- **Bigger features start as a plan** in `docs/plans/<feature>.md` (context,
  API findings, approach), reviewed before building. Plans are working
  notes and stay local (`docs/plans/` is gitignored); anything worth keeping
  goes into `docs/api-notes.md` or a code comment.
- **Look for an existing helper before adding one.** Prefer one general
  function over several one-liners doing the same thing.

## Conventions

- UI text is German; code, comments and commit messages are English.
- Comments explain *why* (usually an API quirk or a design decision), not what.
  Keep them short: one line where possible, a few at most. Measurements and
  investigation stories go in `docs/api-notes.md`, not in the code.
- Commit messages: imperative summary line, then prose on the cause and the fix.

## Never commit

- Tokens, `.env`, or anything from `fixtures/raw/` (real student data).
  Only `npm run anonymize` output may be committed, after reading it.
- An OAuth client *secret* in `public/js/auth/oauth-config.js` — everything
  in `public/` is served to every visitor.
- A new host in the CSP `connect-src` (`public/_headers`) without discussing
  it: it's the privacy guarantee.
