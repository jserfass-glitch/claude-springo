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
- `tools/` the difficulty simulation and the reference-photo fetchers.

## Rules that are easy to break by accident

**No screen ever awaits the network.** Every screen reads IndexedDB; the network
layer only fills it and drains the outbox. The moment a render path does
`await fetch()`, offline stops being a property of the app and becomes a mode
that mostly works.

**Marks are append-only facts.** Never mutate or delete a mark. Unmarking sets
`undoneAt`. That is what makes the offline merge trivial: two devices recording
the same mark is the same fact twice, not a conflict.

**Ink on an accent is not constant, and accents are per-theme.** Each accent
ships `fill`, `ink`, `deep` and `soft`, twice: a light set and a `dark` set.
Never hardcode white text on an accent, and **always read accents through
`accentOf()`**, never straight out of `ACCENTS`. `deep` is a text colour; the
light-mode `deep` on a dark surface measures 2.75:1, which is what the selected
tab label and the live pill are drawn in. Ratios are measured and listed in
`docs/04-design-system.md`.

**Fonts are self-hosted in `app/fonts/` and listed in the `sw.js` shell.** Do
not add a Google Fonts `<link>` back. The worker only caches same-origin, so a
cross-origin font drops to Helvetica exactly in the cold-start-offline case the
whole app is built around. Oswald for display, Archivo for body, SIL OFL 1.1.

**Appearance is Auto, Light or Dark**, stored in `localStorage` under
`springo.theme` and applied by an inline script in `<head>` so a forced theme
does not flash the other one before the module loads. Auto means no
`data-theme` attribute at all, so `prefers-color-scheme` decides. Changing it
must re-run `applyAccent`, or the shell and the accent disagree.

**Reference photos must be licence-filtered** to `cc0`, `cc-by`, `cc-by-sa`
(and public domain on Commons). Much of iNaturalist is CC BY-NC, which breaks
the moment this charges for anything. Always show the author and the licence.
Species come from iNaturalist, everything else from Wikimedia Commons, never a
search engine. A square with no photo shows no reference pane, never an empty
box. Test a pack's photo presence with `p.photoDir != null`: a generated pack's
`photoDir` is `''`, which is falsy.

**A shipped pack's item order and rarity are frozen.** Phones keep each pack
in IndexedDB and `refreshPack` swaps in a deployed edit only when the
key-and-rarity sequence is unchanged, because boards are drawn from it and a
different sequence would reshuffle games in progress. Labels, hints and photos
can change freely. To change the items themselves, ship a new pack id.

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
A news pack (`kind: "news"`, the 2026 pack) plays exactly like a screen pack,
since a headline also reaches everyone at once; `isScreen()` covers both, and
only the setup note differs.

**Board labels must fit two lines in a 360px-wide phone**, about nine
characters a line, with no word longer than that. Longer labels get cut off
with an ellipsis. Put the detail in the hint, which the sheet shows in full.

**Never derive one player's layout from another's by rotating or mirroring.**
The 16 win conditions are invariant under the symmetries of the square, so a
rotated board completes at exactly the same moment as the original, 100% of the
time, measured. Independent shuffles only. `tools/arrangement-ties.mjs`.

**Never bundle a pack named after a show.** Genres are not owned; titles are, and
app stores reject on their own policy long before a fair-use argument gets
heard. Show-specific boards come from the user typing a name and generating one.

**`el.hidden` needs the `[hidden]{display:none !important}` rule** in `app.css`,
because any class that sets `display` silently beats the browser's own rule.

**No emoji anywhere**, in the app, the pack data, the page chrome or the
generation prompt. Items name one of the 22 glyphs in `app/icons.js`: shape says
what a square is, and a hash of the item key picks one of eight colours so a
board of flowers still reads as distinct things. `ICONS` in `app/prompt.js` must
stay in step with `ICON_NAMES` in `app/icons.js`.

**Test touch with touch.** A tap dispatches a synthesized `click` a few
milliseconds after `pointerup`. With a mouse that click targets the element the
gesture started on; with a finger it hit-tests at the touch point, so anything
that just appeared under the thumb receives it. That silently ate every sheet
this app opened on a phone while passing every mouse-driven test. Playwright
needs `hasTouch: true` plus `touchscreen.tap` to catch it.

**A file input can only be opened inside a real user gesture.** `fileIn.click()`
from a `setTimeout` is ignored on iOS. The hold gesture arms on the timer and
fires the camera from the `pointerup` handler for exactly this reason.

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
