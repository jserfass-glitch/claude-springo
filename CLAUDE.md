# Springo

Real-world bingo. Pick a theme, mark a square when you see the thing outside.
The design is argued out in `docs/`; read the relevant one before changing
behaviour, because most of what looks arbitrary here was a decision.

## Layout

- `app/` the app. Plain HTML, CSS and ES modules. **No build step and no
  bundler.** `netlify.toml` publishes this directory as the site root.
- `docs/` the design, numbered 01 to 08.
- `prototype/` the design prototype with a telemetry rail. Superseded by `app/`
  but still the clearest explanation of the motion and colour decisions.
- `netlify/functions/` sync and theme generation. The only things with
  dependencies.
- `tools/` the difficulty simulation and the reference-photo fetcher.

## Rules that are easy to break by accident

**No screen ever awaits the network.** Every screen reads IndexedDB; the network
layer only fills it and drains the outbox. The moment a render path does
`await fetch()`, offline stops being a property of the app and becomes a mode
that mostly works.

**Marks are append-only facts.** Never mutate or delete a mark. Unmarking sets
`undoneAt`. That is what makes the offline merge trivial: two devices recording
the same mark is the same fact twice, not a conflict.

**Ink on an accent is not constant.** Each accent ships `fill`, `ink`, `deep`
and `soft`. Yellow, pink, green and blue take dark ink; violet, purple and red
take white. Never hardcode white text on an accent. Ratios are measured and
listed in `docs/04-design-system.md`.

**Reference photos must be licence-filtered** to `cc0`, `cc-by`, `cc-by-sa`.
Much of iNaturalist is CC BY-NC, which breaks the moment this charges for
anything. Always show the observer and the licence.

**The creator review screen is not optional.** Generation alone fails on wrong
facts, impossible difficulty and abusive input at once. See `docs/08`.

**`sw.js` must never be cached.** `netlify.toml` sets that. A stale service
worker pins users to an old build forever. Bump `VERSION` in `sw.js` when the
shell changes, or clients keep the old files.

**Tap to look, hold to act.** A short tap on a square always opens the sheet,
in both modes; the reference photo is the reason to open a square you have not
marked yet, and this game is about identifying things. Holding for `HOLD_MS`
skips the sheet: honor mode marks, photo mode opens the camera. Never make a
short tap mark straight from the board face, and never make an action reachable
ONLY by holding, since a keyboard user cannot hold.

**A screen pack (`kind: "screen"`) inverts most defaults.** Varied boards
forced on, no photo mode, no reference photo, and a tap marks while a hold opens
the detail. The reasoning is in `docs/09-screen-mode.md`; the short version is
that a trope fires once for the whole room, so identical boards would have
everyone marking the same square at the same second.

**Never derive one player's layout from another's by rotating or mirroring.**
The 16 win conditions are invariant under the symmetries of the square, so a
rotated board completes at exactly the same moment as the original, 100% of the
time, measured. Independent shuffles only. `tools/arrangement-ties.mjs`.

**Never bundle a pack named after a show.** Genres are not owned; titles are, and
app stores reject on their own policy long before a fair-use argument gets
heard. Show-specific boards come from the user typing a name and generating one.

**`el.hidden` needs the `[hidden]{display:none !important}` rule** in `app.css`,
because any class that sets `display` silently beats the browser's own rule.

**No em dashes** anywhere in prose or source.

## Running it

```
python3 -m http.server 8744 --directory app     # everything but sync and generation
npx netlify-cli dev                             # adds /api/springo and /api/springo/generate
```

The camera needs a secure context. `localhost` counts; a LAN IP over plain HTTP
does not, which is why phone testing wants a deploy.

Generation needs `ANTHROPIC_API_KEY`. Without it the endpoint returns 503, the
app says so, and the built-in packs still work with no server at all.

## Verifying a change

There are no unit tests. What is worth checking by hand after touching the app:

1. Create a game, mark squares, reload. The marks must survive.
2. DevTools to Offline, reload. The board must still render.
3. Create a photo-mode game, go offline, open a square you never opened. The
   reference photo must still be there (the service worker pre-warms them).
4. `node tools/difficulty-sim.mjs` if you changed the rules; it reproduces the
   table in `docs/02-game-rules.md`.
