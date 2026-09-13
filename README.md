# Bessere Schule

An unofficial, client-only PWA for [beste.schule](https://beste.schule): grades, timetable,
substitutions and homework in one calm mobile-first view. No backend — the
browser talks directly to `beste.schule/api` with your own Personal Access
Token, and nothing is ever sent anywhere else.

Not affiliated with beste.schule.

## Screens

- **Heute** — today's lessons merged with substitutions, the newest grade, homework due soon.
- **Noten** — overall average and per-subject averages, handling both German grading scales:
  Sek I (Noten 1–6) and Oberstufe (Punkte 0–15, with LK/GK grouping and an Unterkurs count).
- **Fach-Detail** — a subject's grades by weighting, a trend chart, and an expandable
  "So wird gerechnet" explanation of the average.
- **Stundenplan** — the weekly timetable grid.
- **Mehr** — profile, student switcher (for guardian accounts with multiple children), logout.

## Stack

Plain HTML/CSS/JS, ES modules, no build step, no framework. `public/` is the
entire deployable app — served as-is by any static host.

## Running it locally

```
npm run serve
```

Opens a zero-dependency static server at `http://localhost:8080` serving
`public/`. Log in with a beste.schule Personal Access Token: on beste.schule,
go to **Benutzerkonto → API → Personal Access Token erstellen**.

## Scripts

| Command | What it does |
|---|---|
| `npm run serve` | Serves `public/` locally for development |
| `npm test` | Runs the grade-parsing/averaging/trend-chart unit tests (`scripts/test-grades.mjs`) |
| `npm run discover` | Hits every known API route with a token from `.env` (`BESTE_SCHULE_TOKEN`) and saves raw responses to `fixtures/raw/` |
| `npm run cors-check` | Checks which routes send CORS headers for a foreign origin |
| `npm run anonymize` | Copies `fixtures/raw/` → `fixtures/` with names and free text replaced by fakes, safe to commit |

## Deployment

Deploys as a static site to [Cloudflare Pages](https://pages.cloudflare.com/)
(build output directory: `public/`). `public/_headers` sets a strict
Content-Security-Policy — `connect-src` only allows `beste.schule`, so an XSS
bug can't exfiltrate a token or grades anywhere else.

## Docs

- [`docs/plan.md`](docs/plan.md) — architecture, data model, and the phased
  build plan this project follows.
- [`docs/api-notes.md`](docs/api-notes.md) — verified notes on the beste.schule
  API (routes, filters, includes, quirks), recorded against the live API.

## Privacy

Grades and the access token live only in your browser (memory, session/local
storage, and an in-memory request cache) — never on a server, since there is
no server. No analytics, no third-party scripts.
