# 09 Screen mode

Playing a board against a TV show, a film, or a live event instead of against
the outdoors. One player picks "cozy mystery" or types "Murder, She Wrote", and
squares fill with things like *scenic establishing shot of the coastline* and
*the detective has an aha moment*.

This is the right idea, it does reach a much larger audience, and it is a
**different game wearing the same mechanic**. Almost every decision made for the
outdoor game is wrong here. This document is what changes and why.

## It is nearly the inverse of the outdoor game

| | Outdoors | On a screen |
|---|---|---|
| Length | Days to weeks | 22 to 120 minutes |
| Players | Often apart, always asynchronous | Same couch, perfectly synchronous |
| Offline | The whole architecture | Irrelevant, you are on wifi |
| Verification | A photograph | Nothing to photograph |
| The skill | Noticing, and going places | Watching, and having the right square |
| Season | Six weeks of ephemerals | Any night, forever |
| A trigger | Happens to one person | Happens to the whole room at once |

That last row is the one that breaks things.

## Measured: the same 24 items for everyone does not work

Outdoors the default is **same items, shuffled layout**, because two people in
the same woods hunting the same list makes the race comparable. On a screen the
trope fires once, for everyone, at the same second. Every player holding that
square marks it simultaneously, so the only thing separating players is where
the square happened to land on their grid.

Simulated over 200,000 two-player episodes (`tools/screen-pace.mjs`):

| Board style | Exact ties | Games with no winner |
|---|---|---|
| Same items, shuffled layout | **10.7%** | 0.3% |
| Varied items, own list | **0.0%** | 0.0% |

One in nine two-player games ends with both players completing a line on the
*same trigger*. With more people in the room it gets worse:

| Players | At least two tie for the win |
|---|---|
| 2 | 10.8% |
| 3 | 14.8% |
| 4 | 17.1% |
| 6 | 19.8% |

### Arranging the boards differently does not fix this

This is the obvious objection and it is worth answering precisely, because the
intuition behind it is correct everywhere except here.

The boards **are** arranged differently. The simulation above already gives each
player an independently shuffled grid of the same items. The tie rate of 10.8%
is the rate *with* different arrangements.

The reason is that a shared screen removes the clock as a tiebreaker. Work
through what a layout actually decides:

- Both players hold the same 24 items, so at every instant they have exactly the
  same set of squares marked. Only the positions differ.
- A layout therefore does not change *when* you mark anything. It changes only
  **how many marks you need** before some line of yours closes.
- That number is a narrow distribution, because it is a property of a 5 by 5
  grid with 16 win conditions, not of the arrangement:

```
  marks needed to win:  7:2%  8:3%  9:5%  10:8%  11:10%  12:13%
                       13:15% 14:15% 15:13% 16:9%  17:5%  18:2%
```

- So two players are drawing independently from that distribution, and they tie
  when they draw the same number. The chance of that is the sum of the squared
  probabilities, which comes to **10.8%**, matching the measured tie rate to the
  decimal. Arrangement is the only variable in the model, and it is already
  doing everything it can.

Outdoors the same collision happens at the same rate, about 11% of two-player
games need the same *number* of marks. It never shows up as a tie because the
players reach their thirteenth mark days apart. On a shared screen everyone's
thirteenth mark lands in the same second, so a collision in the count *is* the
tie. The clock is what was breaking ties outdoors, and the screen takes it away.

### A warning worth encoding

If anyone ever implements "arrange it differently" as a transform of a base
board, measure it first. Rotating or mirroring a grid is the most natural way to
do that and it is catastrophic:

| Second board is | Ties |
|---|---|
| An independent shuffle | 10.8% |
| The first board rotated 90 degrees | **100%** |
| Rotated 180 degrees | **100%** |
| Mirrored | **100%** |

The set of 16 win conditions is invariant under the symmetries of the square:
rotation maps rows to columns, diagonals to diagonals, and corner stamps to
corner stamps. So a rotated board completes at precisely the same moment as the
original, every single time. Independent shuffles only.

### What actually fixes it

**Varied items.** Each player draws their own list, so they no longer mark in
lockstep and the clock comes back as a tiebreaker. Measured tie rate: 0.0%.
This is the default for screen mode.

**Or strict tap order**, if you want same-items play. There is a real argument
for same items on a screen: the whole room watching for the same things and
shouting at once is good fun, and it makes every board comparable. If you want
that, the tiebreaker cannot be the layout, it has to be the thumb. Screen mode
resolves same-item games by who tapped first, with no tie window at all, which
turns the last square into a reaction race. Outdoor mode keeps its five-minute
window, because punishing the player with worse cell coverage is exactly what
that window exists to prevent.

The one thing that does not work is hoping the arrangement sorts it out.

## Measured: the rarity spread has to change too

A board needs to fill inside one episode. Same simulation, each item firing as a
Poisson process across a 45-minute runtime:

| Rarity mix | No winner | p10 | Median win | p90 |
|---|---|---|---|---|
| Outdoor spread (6 easy / 12 mid / 6 hard) | **14.7%** | 12.4 min | 24.6 min | 38.8 min |
| Common-heavy (6/6/8/3/1 across r1-r5) | **1.9%** | 8.5 min | 17.2 min | 30.5 min |
| All common | 0% | 3.5 min | 6.5 min | 10.7 min |
| Rare-heavy | 36.3% | 14.7 min | 28.6 min | 41.2 min |

The outdoor spread leaves **one episode in seven with no winner at all**. For a
season-long nature board that is fine, you just keep playing. For a party game
it is the worst possible ending, because the credits roll on nothing.

All-common is the opposite failure: bingo lands at minute 6 and the other 39
minutes have no game in them.

**Use the common-heavy mix.** Bingo lands a little past the midpoint, almost
always lands, and the p90 still leaves time for a second player to catch up.

Runtime matters as much as the mix. The same common-heavy board on a 22-minute
sitcom wins at a median of 8.4 minutes, which is too fast; short formats want
either the outdoor spread or a harder win condition (double bingo, or blackout
for a film). The creator screen should pick the mix from a runtime the creator
states, not from a default.

Interesting constant: the winner has about 13.7 marks regardless of mix, almost
identical to the 12.8 the outdoor simulation produced. The board geometry sets
how many squares a win costs; the item rates only set how long that takes.

## Verification without a photograph

Photo mode cannot exist here. You cannot photograph an aha moment, and a
photograph of a television is not evidence of anything.

Two things replace it, and neither is a mechanism:

**The room.** Everyone is watching the same screen. If you claim an aha moment
and nobody agrees, that is a conversation, not a dispute flow. This is the same
argument [02-game-rules.md](02-game-rules.md) makes for outdoor photo mode, and
it is even stronger here because the witnesses are on the same couch.

**Timecode corroboration.** Every mark already carries a timestamp. In screen
mode, record it relative to the start of the session instead of wall clock. Two
players marking the same item within a few seconds of each other corroborates
both, automatically and silently. The simultaneity that broke the board design
turns out to be the thing that makes verification free.

What cannot be fixed by either: items that are not observable. "Someone lies to
the detective" is a judgment call; "the body is found" is not. Item design
carries the weight here, and the generation prompt has to push hard toward
observable events.

## The intellectual property gate, which is the real constraint

This is the part that decides whether the idea ships, and the finding is not the
one you would expect.

**The legal risk is modest. The app store risk is not.** Listing the recurring
tropes of a television show is commentary about a work, not a copy of it, and
using a show's name to say what your card is about is textbook nominative fair
use: you may name a trademark to refer to the thing it names, as long as you use
no more of it than you need and do not imply endorsement. Lawsuits over
fan-made apps are rare.

App stores do not apply that test. They apply their own policies, proactively,
and they reject first. A companion app for a Netflix series was rejected on
intellectual-property grounds; takedowns are processed fast and appeals are
slow. A legal defence you would probably win in court is worth very little
against a listing that is already pulled.

That distinction sets the architecture:

- **Never ship a pack named after a show.** Not in the binary, not in the store
  listing, not in a screenshot. A bundled "Murder, She Wrote" pack is the single
  most rejectable thing this app could contain.
- **Show-specific boards come from the user typing a show name**, generated on
  demand and stored in that user's account. The app ships a generator, not a
  library of other people's IP. This is a meaningfully different posture, and it
  is the one the existing architecture already has.
- **Never use artwork, logos, character images, screenshots, clips, fonts or
  colour schemes from a production.** Text only. This costs nothing here,
  because unlike the outdoor packs there is no reference photo to source.
- **Say it is unofficial**, in the app and in the listing, and never imply a
  connection.
- **Keep a takedown path** and honour requests quickly rather than arguing.
- **Do not let the public pack directory carry show packs.** The moment a user's
  "Murder, She Wrote" pack is browsable content you are distributing, rather
  than something one person generated for themselves, the posture changes for
  the worse.

I am not a lawyer and this is not advice. It is enough to design around; if this
ever becomes a commercial product, the store-policy question specifically is
worth an hour of a real one's time.

## Genre packs are the way in

The escape from all of it: **a genre is not owned by anyone.**

"Cozy Mystery" gets you *scenic establishing shot*, *the aha moment*, *the
gathering of all suspects*, *the local officer is sceptical*, *someone is caught
by a small detail*. That card plays perfectly well against Murder She Wrote,
Midsomer, Poirot, Vera, and a hundred others, and it names none of them.

Genre packs are safe to bundle, safe to screenshot for the store, safe to put in
a public directory, and about 80 percent as sharp as a show-specific card. A
user who wants the sharper version types the show name and generates it
privately. That split gives you a shippable product and the long tail at once.

`app/packs/cozy-mystery.json` is a working example.

Genres worth having: cozy mystery, prestige drama, reality competition, sitcom,
courtroom, hospital, true crime documentary, nature documentary, house hunting,
cooking competition, space opera, heist, holiday romance.

## Generation is *better* here than it is outdoors

The uncomfortable finding from [08-reference-photos.md](08-reference-photos.md)
was that generating a regional species list produces confidently wrong facts:
plants that do not grow where you said. Screen mode does not have that failure
mode, for three reasons:

1. Tropes are enormously well documented. There is far more writing about how
   television works than about what blooms in Newton County.
2. There is no "wrong region" equivalent to get wrong.
3. A slightly-off item is harmless. If *the detective is told to stay out of it*
   only happens in some episodes, that is a hard square, not a falsehood someone
   will learn.

Two constraints still matter, and they replace the regional-accuracy one:

The generator classifies the theme itself, returning `kind: "outdoor" | "screen"`
alongside the items, and the two kinds get different rules. A screen theme is
forced to `sci: null` on every item and the scientific name is stripped server
side even if one slips through, because **there is nothing to look up**. No
iNaturalist call is made, no licence filter runs, no photo is cached, and the
review screen says so instead of showing empty tiles. The whole reference-photo
apparatus in [08-reference-photos.md](08-reference-photos.md), which is the most
expensive and least reliable part of the outdoor pipeline, simply does not exist
here. That is a real simplification, not just a skipped feature.

What replaces it is the hint line. Outdoors a hint helps you identify a plant and
a photograph settles it. On a screen the hint is the *only* thing standing
between two players and an argument, so it has to say what counts rather than
what the thing is: "the body is found, on screen or reported, first discovery
only".

**Tropes, not events.** "The scene where Grady spills coffee" is a hallucination
risk and an unwinnable square. "A relative of the detective is a suspect" is a
pattern that recurs. Generate patterns.

**Series level, not episode level.** A board for one specific episode requires
the model to know that episode, which is exactly where it will invent things.
Refuse episode-level themes and generate for the series.

Also worth a prompt rule: this genre of card has a long association with
drinking games, and the app is rated 13+. Nothing in a generated list should be
an instruction to drink.

## Where the audience actually is

The honest answer to "reach a larger audience" is not television. It is **live
events**.

A Tuesday rerun is a handful of people on a couch. An awards show, a
championship game, an election night, a season finale, a royal wedding is
millions of people watching the same thing at the same minute, once a year,
every year. That is:

- simultaneous at enormous scale, which is what makes a shared board interesting
- recurring, so a pack gets better each year instead of being disposable
- intensely social, and the cards get screenshotted and posted, which is the
  cheapest acquisition this product will ever get
- seasonal in a way that *complements* the ephemerals rather than competing:
  spring boards in April, awards boards in March, football in the autumn

One caveat: some event names are policed far more aggressively than television
titles. The most famous American football championship is the standard example
of a rights holder that pursues even oblique references. Generic event themes
and user-typed ones sidestep this; a bundled pack named after a specific event
does not.

## Screen mode is where strangers become safe

Worth noticing, because it reverses another earlier conclusion.
[01-product.md](01-product.md) cuts random matchmaking from v1 mostly because
photo sharing between strangers is a moderation problem that needs a queue and a
team.

Screen mode has no user-generated media at all. No photos, no free text, just
taps against a list the app generated. A public lobby of five hundred strangers
all watching the same finale exchanges nothing but marks.

**If random matchmaking ever ships, it should ship here first.** It is the mode
where it is both safest and most valuable, and it can be built without any of
the moderation machinery the outdoor version would need.

## What the app has to change

Smaller than it looks, because most of it is defaults:

| | Change |
|---|---|
| Board style | Varied by default, and say why on the create screen |
| Rarity mix | Common-heavy, selected from a stated runtime |
| Photo mode | Not offered |
| Reference photo | Does not exist; the item's "what counts" line takes its place |
| Timestamps | Relative to session start, not wall clock |
| Session | An elapsed timer, and an end when the runtime does |
| Offline | Irrelevant. Do not remove it, just stop advertising it |
| Life List | Excluded. A collection of tropes is not a record of anything, so screen marks never enter it |
| Live sync | Actually matters here, unlike outdoors. Everyone should see marks land |

**One interaction changes, and it is worth stating on its own.** Outdoors, a tap
opens the square because the reference photo is the reason to open an unmarked
square, and holding is the shortcut. On a screen there is no reference photo and
the player is trying to watch television, so a tap should mark immediately and
holding should open the detail. The principle is the same in both modes, put the
primary action on the tap; it produces opposite bindings because the modes have
opposite primary actions.

## Recommendation

Build it, as a second mode with its own identity, and lead with genres rather
than shows.

It genuinely solves the seasonality problem in [01-product.md](01-product.md):
ephemerals bloom for six weeks, and television is on every night of the year.
It is the strongest argument for keeping generation in the product, because
generation works better here than in the use case it was built for.

Two things to be clear-eyed about. **It is a more crowded space.** Nature
observation bingo is distinctive; movie bingo is not, and the competition is
every drinking-game app ever shipped. And **retention is worse, not better**.
A Life List accrues for years; a card for last night's episode is rubbish today.
Expect screen mode to bring installs and outdoor mode to keep them, and design
the app so a screen-mode player discovers there is a spring waiting for them.

Build order, if it happens: the genre packs first, since they are pure content
and need no new code; then the varied-board and rarity defaults; then the
session timer; then live sync; and only then, if it has legs, the public lobby
that makes an event night worth being part of.
