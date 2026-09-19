# Hyperframes Composition Brief: Bessere Schule

## Objective
Create a short, polished launch-style brag video for Bessere Schule, an unofficial client-only PWA for beste.schule.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 20 seconds

## Source Material
- Project root: `/home/user/better-student-app`
- Primary files read: `public/index.html`, `public/css/tokens.css`, `public/css/app.css`, `README.md`, `public/js/views/{heute,noten,stundenplan}.js`, `public/js/components/bottom-nav.js`
- Product name: Bessere Schule
- Tagline / strongest claim: no backend — the browser talks straight to beste.schule's API, nobody else ever sees a student's data or password
- Key UI moments to recreate: the Heute "Änderungen heute" card + lesson list, the Stundenplan Mo–Fr grid with changed/cancelled cells, the Noten Oberstufe average + LK/GK subject rows with sparkline trends
- Copy that must appear verbatim:
  - "Deine Noten. Kein Server dazwischen."
  - "Dein Passwort sieht nur beste.schule."
  - "Noten, Stundenplan, Vertretungen. Ohne Umwege."

## Creative Direction
- Tone preset: polished
- Creative direction: quiet, confident product film. The restraint itself is the argument for a privacy-respecting app — no jokes, no chaos, no hype language.
- Interpretation: longer holds per scene, soft crossfades, generous whitespace, serif display type carrying the emotional weight instead of motion tricks.
- Angle: the app's real differentiator is architectural (no server, no backend) rather than a feature list; prove it's real by showing three actual, detailed screens, not a generic mockup.
- Hook: "Deine Noten. Kein Server dazwischen." over a cream background, wordmark settles beneath it.
- Outro / punchline: "Dein Passwort sieht nur beste.schule." then the share line "Noten, Stundenplan, Vertretungen. Ohne Umwege."
- Avoid:
  - Generic SaaS language ("streamline your workflow")
  - Abstract filler visuals / stock motion graphics
  - Any redesign of the real screens — use them as captured

## Visual Identity
- Background: `#F6F3EE`
- Text: `#1A1714` (primary), `#57504A` (secondary), `#6F6862` (muted)
- Accent: `#A8341C` (light mode terracotta)
- Display font: Instrument Serif (Google Fonts)
- Body font: Instrument Sans (Google Fonts)
- Visual references from the project: `brag-output/fixtures/heute-light.png`, `brag-output/fixtures/stundenplan-light.png`, `brag-output/fixtures/noten-light.png` — pixel-real captures of the actual app screens (real CSS, real markup, sample data), each 960×1800 at device-scale 2, phone aspect ratio.

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 2.5s — "Deine Noten. Kein Server dazwischen." + wordmark
2. Heute — 5s — Änderungen-heute card settles first, then the lesson list
3. Stundenplan — 4.5s — Mo–Fr grid, 4 changed/cancelled cells highlight in sequence
4. Noten — 4.5s — "11 P" average counts up, then LK/GK subject rows with sparklines settle in
5. Outro — 3.5s — "Dein Passwort sieht nur beste.schule." + share line + small "inoffiziell" subtext

## Audio
- Audio role: warm, sparse professional bed
- Audio arc: bed starts low under the hook, steady through the three screens, fades in the last 1.5s under the outro line
- Music: `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` (bundled with the brag skill, copied to `composition/assets/music/`)
- Music treatment: fade in 0–1s, steady bed through scenes 2–4, fade out over the last 1.5s
- Music cue guidance: preset cues available at `~/.claude/skills/brag` assets (strong cues at 3.70s, 4.23s, 5.28s, 6.34s, 8.44s, 10.54s, 12.65s; tempo ~115 BPM). Use 1-3 of these for major scene-start reveals; ignore any that hurt readability.
- Audio-reactive treatment: none planned — polished restraint. If Hyperframes' audio-reactive workflow is trivial to wire (e.g. a subtle glow/presence response on the phone frame), it may add it subtly; otherwise skip.
- Audio-coupled moments:
  - Heute — one soft UI tick as the Änderungen card settles
  - Stundenplan — 4 soft ticks as each changed cell highlights, snapped to the beat grid
  - Noten — one soft count-up tick resolving as "11 P" settles
- SFX selection guidance: card/UI tick sounds from the bundled `assets/sfx/ui/` set; low high-frequency-risk files preferred since the tone is calm and these sounds repeat.
- SFX analysis guidance: consult the skill's `assets/sfx/sfx-analysis.md` if present.
- Exact SFX choice: Hyperframes chooses exact filenames/timestamps/volume based on the implemented animation.
- Audio files: copy `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` and any chosen SFX into `brag-output/composition/assets/`.

## Hyperframes Instructions
Load `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. This is `/brag`'s own workflow — do not enter the generic `hyperframes` intent interview or promo/launch-video workflow.

Requirements:
- Show all three real UI screenshots (Heute, Stundenplan, Noten) — they are pre-rendered pixel-accurate captures of the real app, not to be redrawn.
- Keep all text readable in the final render (respect the reading-time floor).
- Keep total duration at 20 seconds (15-25s range).
- Include the planned music + sparse SFX layer.
- Treat cue timestamps as optional hints; readability and the product story win over beat-snapping.
- Run `npx hyperframes check` before render — the single gate.
