# Springo, playable build

An installable, offline-first web app. Open it on a phone, add it to the home
screen, and it behaves like an app: it cold-starts with no signal, keeps your
boards and photos on the device, and takes real photographs.

The design it implements is in [`../docs/`](../docs/). This is the build meant
for a real season test, not a mockup.

## Trying it

It is served from the repo root like everything else on this site, so once this
branch is deployed it lives at **`/app/`**.

Locally:

```
python3 -m http.server 8744      # from the repo root
open http://localhost:8744/app/
```

The camera needs a secure context. `localhost` counts, so local testing works;
a plain-HTTP LAN address does not, which is why phone testing wants the
deployed URL.

## What works with no server at all

Everything except seeing another person's marks:

- creating a game from any of the three packs, boards, marking, win detection
- photo mode, real capture, the resize and compression pipeline, EXIF stripping
- reference photos and their attribution
- the Life List, stats, multiple games at once
- **cold-start offline**: the service worker caches the shell, the packs and
  the reference photos, so opening the app in a hollow with no bars works

Games created with no server are marked `SOLO` and stay on the device.

## Typing your own theme

Type a theme, optionally a region, and Springo proposes about 36 items. You then
get the **review screen**: every item as a row with its name, scientific name,
hint, rarity and a reference photo, and you tap to drop the ones you do not
want, or type your own. A board needs 24 kept; the button stays disabled until
you have them.

That screen is the whole reason generation is shippable. Left to itself,
generation fails three ways at once: wrong facts, impossible difficulty, and
abusive input. One minute of review fixes all three, and the reviewed list is
saved as a real pack you can replay.

Reference photos for generated items are looked up in the browser against
iNaturalist, research grade, filtered to cc0 / cc-by / cc-by-sa, with the
observer and licence shown under the photo.

Needs `ANTHROPIC_API_KEY` set on the Netlify site. Without it the endpoint
returns 503 and the app says so, and the ready-made packs keep working with no
server at all.

One caveat: the call uses `effort: "medium"` with adaptive thinking to stay
inside a synchronous function timeout. If your Netlify plan's timeout is tight
and you see failures, drop it to `"low"` in
`netlify/functions/springo-generate.mjs`.

Generation is rate limited to 12 new themes per client per day, and results are
cached by normalised theme and region, so replays and near-duplicate wordings
cost nothing. It is the only part of this that costs real money per call.

## Turning sharing on

Two one-time steps, both on Netlify:

1. `npm install` at the repo root, so `@netlify/blobs`, `@anthropic-ai/sdk`
   and `zod` are available to the functions. These are the first dependencies
   the repo has ever had. They are used **only** by the two functions under
   `netlify/functions/`; the site itself still has no build step and no
   bundler touches the HTML.
2. The Netlify site must be linked and have Blobs enabled, which it is by
   default on current Netlify projects. No keys, no dashboard config.

The app probes `/api/springo` once on load. If it answers, new games get a
six-character code and sync; if it 404s, the app silently runs local-only and
says `LOCAL ONLY` in the status row. Nothing breaks either way.

To share a game: create it, then **Share the link** on the invite screen. The
other person opens the link and is dropped straight into the join flow.

## What this build does not do yet

Named honestly, because the gaps are the roadmap:

- **Photos never leave the device.** The sync endpoint carries marks only.
  Seeing your opponent's photo needs real object storage, which is the next
  thing to build. Marks, boards and wins do sync.
- **No push notifications.** The status row and a manual sync are the only ways
  to learn that someone marked something. This matters: the design argues the
  notification is the most important surface in the product, and this build
  cannot test that claim.
- **No accounts.** Identity is a name you type, kept in IndexedDB. Clearing site
  data is the same as deleting your account. Fine among people who know each
  other, not fine for strangers.
- **No random matchmaking, leaderboards or achievements.** Deliberately out of
  scope for a season test.
- **Win arbitration runs on the client.** The bounded-client-time stamping and
  the five-minute tie window are implemented in `game.js` and the server clamps
  timestamps, but the authoritative decision is not yet server-side.

## Files

| File | What it is |
|---|---|
| `game.js` | Pure rules. Board generation, win detection, bounded client time, tie handling. No DOM, no network, so it can move to a server unchanged |
| `store.js` | IndexedDB. Games, marks, photos, packs, and the outbox |
| `sync.js` | The one sync endpoint, plus the probe that decides local-only |
| `app.js` | UI, camera, capture pipeline, animations |
| `sw.js` | Service worker. This file is what makes offline real rather than a mode |
| `packs/*.json` | Pack definitions. Items, hints, rarity, photo filenames, credits |
| `../packs/<id>/` | Reference photos, one directory per pack |
| `../netlify/functions/springo.mjs` | The sync function |
| `../netlify/functions/springo-generate.mjs` | Theme generation, on Claude Opus 5 with a structured output schema |

## Testing it for real

Play **Ozark Fall** now. Nothing in the spring pack blooms until late February,
and a season test that waits six months is not a test. The fall pack is fungi,
fruit and colour, all findable in Arkansas between September and November.
