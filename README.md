# Springo

A bingo game you play by walking around and looking at things.

One player picks a theme, everyone gets a board drawn from that theme, and you
mark squares when you see the real thing in the real world. First bingo wins.

It came from making Arkansas spring ephemeral bingo cards on paper and marking
them off over a season. That origin is the spec. Everything here is built around
a game that is **slow, shared, and often played out of signal**, not a match
that starts and ends in six minutes.

## The app

[`app/`](app/) is a working, installable, offline-first web app, not a mockup.
It cold-starts with no signal, takes real photographs, runs a real compression
and EXIF-stripping pipeline, and keeps everything on the device. `netlify.toml`
publishes `app/` as the site root, so a deploy of this repo *is* the game.

```
python3 -m http.server 8744 --directory app
open http://localhost:8744/
```

That gets you everything except theme generation and sharing between people,
both of which need the two functions in `netlify/functions/`. See
[`app/README.md`](app/README.md) for the setup and for an honest list of what
this build does not do yet.

## Layout

| Path | What it is |
|---|---|
| [`app/`](app/) | The app. Plain HTML, CSS and ES modules; no build step |
| [`docs/`](docs/) | The design, argued out. Read these before changing behaviour |
| [`prototype/`](prototype/) | The design prototype, with a live telemetry rail. Superseded by `app/` but useful for explaining the motion and colour decisions |
| [`netlify/functions/`](netlify/functions/) | Sync, and theme generation on the Claude API |
| [`tools/`](tools/) | The difficulty simulations and the reference-photo fetcher |

## Documents

| File | What is in it |
|---|---|
| [`docs/01-product.md`](docs/01-product.md) | What the app is, who it is for, the risks in the brief, what to cut from v1 |
| [`docs/02-game-rules.md`](docs/02-game-rules.md) | Board generation, win patterns, difficulty maths, the two modes |
| [`docs/03-ux.md`](docs/03-ux.md) | Screens, flows, the multi-game tab model, notifications |
| [`docs/04-design-system.md`](docs/04-design-system.md) | Palette, type, shape, motion specs, accessibility |
| [`docs/05-architecture.md`](docs/05-architecture.md) | Stack choice, offline model, win arbitration, photo pipeline |
| [`docs/06-data-model.md`](docs/06-data-model.md) | Postgres schema, RLS sketch, win detection code |
| [`docs/07-roadmap.md`](docs/07-roadmap.md) | v1 scope, build order, cost model, open questions |
| [`docs/08-reference-photos.md`](docs/08-reference-photos.md) | Sourcing species photos from the internet, what it costs, what it misses |
| [`docs/09-screen-mode.md`](docs/09-screen-mode.md) | Playing against a TV show, a film or a live event. Why nearly every outdoor default inverts, and where the intellectual property line actually is |
| [`prototype/index.html`](prototype/index.html) | Interactive prototype. Tap squares, take a real photo in photo mode, watch the win animation |

## The seven decisions that matter

**1. Boards share the same 24 items, shuffled per player.**
The original use case was two people in the same woods. Same items makes it a race
and makes "look at their board" legible. Different items makes wins
incomparable. Varied boards stay available as a creator toggle for players who
are far apart.

**2. Free space on, centre, by default.**
Without it, the postage stamp (4 squares) is strictly easier than any line
(5 squares) and every game ends in a corner. With it, centre lines and the
stamp both need 4, which keeps the win conditions level.

**3. Themes are generated, then reviewed by the creator before the game starts.**
(Built: type a theme in [`app/`](app/) and the review screen is the next thing
you see.)
You type "Arkansas spring ephemerals", the app proposes 30 to 40 items as
chips, you delete and swap and add, then boards are drawn. Pure generation
fails three ways at once: wrong facts, impossible difficulty, and abusive
input. Creator review fixes all three and produces a reusable pack as a side
effect, which is the growth loop.

**4. Offline wins are ordered by bounded client time, and near-ties are ties.**
Ordering by server receipt punishes the person with worse signal, who is
exactly the user offline mode is for. Ordering by raw device clock is
trivially cheated. See [`docs/05-architecture.md`](docs/05-architecture.md).

**5. The photo is a souvenir, not evidence.**
Photo mode reads like anti-cheat but it is not, and building a dispute system
around it is wasted work. What settles an argument is the square's detail sheet
showing a licensed reference photo beside your opponent's photo at the same
size. Anyone can judge that in one glance, it stays friendly, and it comes free
once the sheet exists. See
[`docs/08-reference-photos.md`](docs/08-reference-photos.md).

**6. Add a Life List.**
Borrowed from birding. Every distinct thing you have ever marked, with your
photo and the date, kept forever across every game. It is the reason to open
the app in July when nothing is blooming, and it is what makes photo mode worth
its friction. This is the strongest idea in the design and it was not in the
brief.

**7. Cut random matchmaking from v1.**
It is the most expensive thing in the brief (matchmaking, moderation pipeline,
age gating, abuse tooling) and the least validated. Ship the game you and your
wife actually played first.

## The risks worth reading before anything gets built

- **The app is rated 13+**, which settles the all-ages tension in the original
  brief and removes COPPA entirely: no parental consent flow, no parent
  dashboard, no under-13 mode. Random matches stay photo-free regardless.
  [`docs/01-product.md`](docs/01-product.md#safety).
- **Strip EXIF from every photo, always.** A trillium photo carries the GPS
  coordinates of a place someone stands regularly. This is the most
  under-considered risk in the brief.
- **A global wins leaderboard will be farmed in a week.** Invite an alt
  account to a "things in my kitchen" game and win in four minutes.
- **Spring ephemerals bloom for about six weeks.** If that is the app's
  identity, usage dies in May.
- **Automated photo sourcing gets to about 75 percent usable**, measured over
  24 real species. The rest needs a person to look, which is why the creator
  review screen reviews photos as well as items.
