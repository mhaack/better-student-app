<p align="center">
  <img src="public/icons/icon-192.png" alt="Bessere Schule" width="120" height="120">
</p>

<h1 align="center">Bessere Schule</h1>

<p align="center">
  An unofficial, client-only PWA for <a href="https://beste.schule">beste.schule</a>:<br>
  grades, timetable, substitutions and homework in one calm, mobile-first view.
</p>

There is no backend. The browser talks straight to `beste.schule/api`, and your
data never reaches anyone else — because there is no one else to reach.

Not affiliated with beste.schule.

## Screens

- **Heute** — today's lessons with their status (room change, stand-in teacher,
  cancelled — each readable without relying on colour), a summary of what
  changed, the latest grade, and upcoming Klassenbuch entries.
- **Noten** — overall average and per-subject averages, handling both German
  grading scales: Sek I (Noten 1–6, 1 is best) and Oberstufe (Punkte 0–15, 15
  is best, with LK/GK grouping and an Unterkurs count). Averages the school
  doesn't publish are marked *geschätzt* rather than presented as official.
- **Fach-Detail** — a subject's grades grouped by type and weighting, a trend
  chart plotted against the full scale (so the axis tells the truth), and an
  expandable "So wird gerechnet".
- **Stundenplan** — Mo–Fr as a grid, with changes marked in place. Shows the
  current week, and rolls to the next one once the weekend starts.
- **Mehr** — profile, student switcher (for guardian accounts with several
  children), logout.

Light and dark, 390 px up.

## Logging in

"Mit beste.schule anmelden" runs a standard OAuth 2.0 **Authorization Code flow
with PKCE**, entirely in the browser. The app never sees your password, and no
server or edge function sits in the middle — beste.schule sends CORS headers on
its token endpoint, so the code exchange is a plain `fetch` (see
[`docs/api-notes.md`](docs/api-notes.md)).

Because the client is a *public* PKCE client, it has **no client secret** —
nothing confidential ships in the bundle. Tokens live in your browser and are
refreshed automatically when they expire.

### Setting up your own OAuth client

1. On beste.schule: **Benutzerkonto → API → OAuth-Clients**, create a client and
   tick **Proof Key for Code Exchange**.
2. Register a redirect URI for every origin you'll use — they must match
   exactly, **trailing slash included**:
   - `http://localhost:8080/` for local development
   - `https://your-domain/` for the deployed app
3. Put the client id in [`public/js/auth/oauth-config.js`](public/js/auth/oauth-config.js).

The id is a small integer, and a PKCE client is shown *without* a secret — that
looks like a failed creation but is correct. A client id is public by design
here; a client *secret* must never go in that file, since everything in
`public/` is served to every visitor.

## Running it locally

```
npm run serve
```

A zero-dependency static server on `http://localhost:8080`, serving `public/`.

## Stack

Plain HTML/CSS/JS, ES modules, no build step, no framework, no dependencies.
`public/` is the entire deployable app, served as-is by any static host.

```
public/js/
  app.js        routing table + app shell, handles the OAuth callback on boot
  api/          fetch wrapper (retry, refresh-on-401) + mappers to domain shapes
  auth/         PKCE helpers, the OAuth flow, client config
  data/         per-screen aggregation (merging plans, computing averages)
  domain/       grade parsing, averaging, trend geometry — pure, unit-tested
  state/        session storage and the resolved school context
  views/        one module per screen, rendering into the app shell
  components/   shared bits: bottom nav, skeletons, empty/error states
  util/         escaping and German date/number formatting
```

## Scripts

| Command | What it does |
|---|---|
| `npm run serve` | Serves `public/` locally for development |
| `npm test` | Unit tests: grade parsing/averaging/trend geometry, and the PKCE helpers against RFC 7636's own test vectors |
| `npm run discover` | Hits every known API route with a token from `.env` (`BESTE_SCHULE_TOKEN`) and saves raw responses to `fixtures/raw/` |
| `npm run cors-check` | Checks which routes send CORS headers for a foreign origin |
| `npm run anonymize` | Copies `fixtures/raw/` → `fixtures/` with names and free text replaced by fakes, safe to commit |

`discover` still uses a Personal Access Token — that's for exploring the API
from the command line, not for the app.

## Deployment

A static site on [Cloudflare Pages](https://pages.cloudflare.com/): no build
command, build output directory `public`. Nothing else in the repo is
published.

[`public/_headers`](public/_headers) sets a Content-Security-Policy whose
`connect-src` allows only `beste.schule` — so even an XSS bug could not
exfiltrate a token or a single grade anywhere else.

Remember to register the deployed origin as a redirect URI on the OAuth client,
or login will work locally and fail in production.

## Docs

- [`docs/plan.md`](docs/plan.md) — architecture, data model, and the phased
  build plan this project follows.
- [`docs/api-notes.md`](docs/api-notes.md) — what the beste.schule API actually
  returns: routes, filters, includes, and the quirks worth knowing before
  touching the data layer.

## Privacy

Grades and tokens live only in your browser — memory, session/local storage and
an in-memory request cache. There is no server to send them to. No analytics,
no third-party scripts, no tracking.
