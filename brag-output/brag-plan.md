# Brag Plan: Bessere Schule

## What is this app?
An unofficial, client-only PWA for beste.schule that shows a German student their grades, timetable, substitutions and homework in one calm mobile view — with no backend and no server ever seeing their data.

## The angle
The genuinely impressive claim isn't a feature, it's an architecture decision: there is no backend at all. The browser talks straight to beste.schule's API over OAuth PKCE; nobody else — not even this app's own maker — ever sees a student's grades or password. The video leads with that claim, then proves it's not just marketing by showing three real, detailed screens (today's changes, the week grid, the Oberstufe point average) that only make sense if the app actually works.

## Hook (first 2-3 seconds)
Full-bleed cream card, serif type: **"Deine Noten. Kein Server dazwischen."** ("Your grades. No server in between.") — the tagline sits alone, confident, then the wordmark "Bessere Schule" settles under it.

## Key moments (the middle)
- **Heute**: the "Änderungen heute" accent card arrives first (Physik → Raum 204, Sport entfällt), then the day's lesson list settles in below it — the app surfacing exactly what changed before anything else.
- **Stundenplan**: the Mo–Fr grid appears, and the four changed/cancelled cells (accent-tinted or dashed) pop against the plain white cells one after another, showing a whole week's exceptions at a glance.
- **Noten**: the Oberstufe average count up to "11 P", then the Leistungskurse/Grundkurse rows settle in with their sparkline trends — proof the app understands the actual German grading system (0–15 points, LK/GK), not a generic grade tracker.

## Outro / punchline
Return to the cream hook background. Line: **"Dein Passwort sieht nur beste.schule."** ("Only beste.schule ever sees your password.") under the wordmark, then the share line settles: "Noten, Stundenplan, Vertretungen. Ohne Umwege." Small subtext: "Inoffiziell. Nicht verbunden mit beste.schule."

## User flow worth showing
Entry → key action → result, across the app's three core screens rather than a single flow: open the app to **Heute** (today's changes surfaced first) → check **Stundenplan** for the week's exceptions → check **Noten** for the Oberstufe average. This is the app's real daily-use loop for an Oberstufe student, not a landing page.

## Tone
- Preset: polished
- Creative direction: quiet, confident product film — the restraint itself is the argument for a privacy-respecting app. No jokes, no chaos, no fake hype language.
- Interpretation: longer holds per scene, soft crossfades, generous whitespace, serif display type doing the emotional work instead of motion tricks. Nothing arrives faster than it can be read.

## Format: vertical — 1080x1920
## Duration: 20s

## Visual identity (from the project)
- Background: `#F6F3EE` (warm cream)
- Accent: `#A8341C` (terracotta red)
- Text: `#1A1714` (near-black), secondary `#57504A`
- Display font: Instrument Serif
- Body font: Instrument Sans
- Strongest visual element: the real app screens themselves (Heute, Stundenplan, Noten) at native mobile width — real markup, real CSS, no mockup gloss.

## Share copy (draft)
Deine Schule läuft jetzt clientseitig: Noten, Stundenplan und Vertretungen — dein Passwort sieht nur beste.schule. 🎒

## Audio direction
- Role: warm, sparse professional bed — confidence through restraint, not energy
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (tempo ~115 BPM, "Business Moves" mood fits a calm-but-competent product film)
- Music treatment: starts at 0s under the hook at low volume, gentle swell into the Heute scene, steady bed through the highlights, soft fade in the final 1.5s under the outro
- Music cue guidance: strong cues at 3.70s, 4.23s, 5.28s, 6.34s, 8.44s, 10.54s, 12.65s (from bundled preset) — align scene-start crossfades to the nearest strong cue rather than forcing exact beat-snap on text
- Audio-reactive treatment: none — polished restraint, no waveform/glow gimmicks
- SFX posture: sparse; one soft card-arrival tick for the Änderungen card, one for the Stundenplan cell highlights, one soft count-up tick under the Noten average landing on "11 P"
- Audio-coupled moments: Stundenplan's 4 changed cells popping in one-by-one (each gets a soft, quiet tick); Noten average counting up
- Restraint rule: no chaotic percussion hits, no meme SFX, no more than one sound per visual beat

## Storyboard

### Scene 1 — Hook — 2.5s
Cream full-bleed background. Serif headline "Deine Noten. Kein Server dazwischen." fades/settles in, wordmark "Bessere Schule" arrives beneath it a beat later.
Sequential/interaction: none
Audio intent: calm, confident open under the music's intro
Audio-coupled idea: none
Music: warm bed starts at 0s, low volume
Transition mood: soft crossfade → Scene 2

### Scene 2 — Heute — 5s
Phone-frame screenshot of the real Heute screen. The "Änderungen heute" accent card is emphasized first (subtle scale/glow settle), then the eye moves down the lesson list beneath it.
Sequential/interaction: yes — the accent card settles in first, then the lesson rows below it
Audio intent: a small, satisfying "here's what changed today" beat
Audio-coupled idea: one soft UI tick as the accent card settles
Music: steady bed
Transition mood: soft crossfade → Scene 3

### Scene 3 — Stundenplan — 4.5s
Phone-frame screenshot of the Mo–Fr grid. The 4 changed/cancelled cells highlight in sequence (room change → substitution → note → cancelled), each with a quiet tick, while the rest of the grid holds still.
Sequential/interaction: yes — 4 cells highlight one by one across the grid
Audio intent: light, rhythmic confirmation — the week's exceptions surfacing one at a time
Audio-coupled idea: 4 soft ticks timed to the cell highlights, on the beat grid
Music: steady bed
Transition mood: soft crossfade → Scene 4

### Scene 4 — Noten — 4.5s
Phone-frame screenshot of the Noten (Oberstufe) screen. The "11 P" average counts up from 0, then the Leistungskurse/Grundkurse rows and their sparkline trends settle in below.
Sequential/interaction: yes — average counts up, then subject rows settle in as a group
Audio intent: a quiet, earned landing on the number
Audio-coupled idea: soft count-up tick resolving as "11 P" settles
Music: steady bed, slight swell
Transition mood: soft crossfade → Scene 5

### Scene 5 — Outro — 3.5s
Return to the cream background. "Dein Passwort sieht nur beste.schule." settles, then the share line and small "inoffiziell" subtext beneath the wordmark.
Sequential/interaction: none
Audio intent: settle and land; the claim gets the last word
Audio-coupled idea: none
Music: fades out over the last 1.5s
Transition mood: soft hold → end

**Music mood for this video:** warm, confident, understated — a business-casual bed, never chaotic
**Audio summary:** One continuous warm bed from 0s, four quiet UI ticks tied to on-screen reveals (Heute card, 3 Stundenplan cells... i.e. one per scene highlight), fading out under the final line — restraint throughout, no percussion hits or hype stings.
