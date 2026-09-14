# 02 Game rules

## The board

5 by 5. Twenty-four item squares plus a free centre square.

Cell indices used throughout the code and this document:

```
 0  1  2  3  4
 5  6  7  8  9
10 11 12 13 14      12 is the free space
15 16 17 18 19
20 21 22 23 24
```

## Win patterns

| Pattern | Count | Squares needed with free space |
|---|---|---|
| Row | 5 | 5, except the middle row which needs 4 |
| Column | 5 | 5, except the middle column which needs 4 |
| Diagonal | 2 | 4 each, both pass through the centre |
| Postage stamp | 4 | 4 each |

A postage stamp is a 2 by 2 block in a corner: `[0,1,5,6]`, `[3,4,8,9]`,
`[15,16,20,21]`, `[18,19,23,24]`. It is four squares, not five. The brief says
"5 squares in a row, or the postage stamp", so state the four-square rule
explicitly on the rules sheet or players will argue about it.

Sixteen win conditions total. Each is a creator toggle, but the default is all
four kinds on, free space on.

## Difficulty, measured

Monte Carlo over 400,000 boards, marking squares in uniformly random order,
counting marks until the first win. Reproduce with
`node tools/difficulty-sim.mjs`.

| Ruleset | Mean marks | p10 | Median | p90 | Fastest seen |
|---|---|---|---|---|---|
| Free space + stamps (default) | 12.8 | 9 | 13 | 16 | 4 |
| Free space, lines only | 13.6 | 10 | 14 | 17 | 4 |
| No free space + stamps | 13.9 | 10 | 14 | 17 | 4 |
| No free space, lines only | 14.9 | 11 | 15 | 18 | 5 |

Three things this changes about the design:

**The postage stamp is not the cheapening mechanic it looks like.** Turning it
on shaves only about 0.8 marks off the mean. The intuition that four squares
beats five is right per-line, but there are only four stamps against twelve
lines, and corners are covered by rows and columns anyway. Leave it on by
default without worrying.

**A typical game is 13 of 24 squares.** More than half the board. For a season
board of spring ephemerals that is a genuine hunt lasting weeks, which is the
right feel. For a road trip pack of common things it will end in an hour, which
is also right. Difficulty lives in the item list, not the rules.

**Show the creator the number.** At game creation, display "typical bingo: 13
marks, usually 11 to 16" next to the rules toggles, and let them see the effect
of turning the free space off. This is cheap to build and it is the only way a
creator can reason about how long their game will run.

Win pattern share in the default ruleset: rows 30%, columns 28%, stamps 26%,
diagonals 15%. Reasonably even, which is what you want. Nothing feels like a
gimmick.

## The "one away" state lasts longer than you think

In the same simulation, a player sits one square away from a bingo on at least
one line for an average of **5.2 marks** before actually closing one. In a game
that spans weeks, that is days of being one away.

Design consequence: do not build a loud near-bingo state. No banner, no push
notification saying "you are one away", no sound. Those would fire repeatedly
for a third of every game and become noise. The near-bingo signal should be a
very low amplitude breathing highlight on the candidate squares and nothing
else. See the motion spec in [04-design-system.md](04-design-system.md).

## Board generation

The pack supplies a pool of N items. The game supplies a seed.

**Shuffled boards (default).** Choose 24 items from the pool once for the whole
game. Every player gets those same 24 in a per-player shuffled order. Boards
differ in layout, not in content.

- Pro: wins are directly comparable, the race is real, viewing an opponent's
  board is legible because you recognise every square.
- Pro: a creator who curated 24 good items gets exactly those 24.
- Con: if players are in different places, one may have a list that does not
  match their surroundings.

**Varied boards (toggle).** Each player draws 24 from a pool of 30 or more.
Boards differ in content.

- Use when players are geographically separated.
- Requires the pool to be at least 30, and the UI should say so rather than
  silently falling back.
- Wins become less comparable. Warn the creator in one line.

Generation is deterministic from `(game_seed, player_id)` so a board can be
regenerated on any device from three numbers rather than synced cell by cell.
That matters for offline: a player who joins on a second device gets the
identical board with no network round trip beyond the pack itself.

```ts
// board cells are derived, never stored as the source of truth
function boardFor(gameSeed: string, playerId: string, pool: Item[], opts: Opts) {
  const rng = xoshiro128(hash(gameSeed + ':' + playerId));
  const chosen = opts.style === 'shuffled'
    ? shuffle(opts.sharedTwentyFour, rng)   // same items, new layout
    : shuffle(pool, rng).slice(0, 24);      // new items
  return opts.freeSpace
    ? [...chosen.slice(0, 12), FREE, ...chosen.slice(12)]
    : shuffle(pool, rng).slice(0, 25);
}
```

## The two modes

**Honor mode.** Tap a square, it is marked. Nothing else. This is the default
and it should be, because it is the mode that works while you are holding
binoculars in the rain.

**Photo mode.** Tapping a square opens the camera. The mark lands the moment
the shutter fires, not when the upload completes. This ordering is not
negotiable: a player out of signal must be able to mark, and the photo uploads
later from the outbox.

Both modes let every player open every other player's board and see their
marks. In photo mode they also see the photos, full screen, with the date.

### The photo is a souvenir, not evidence

The brief frames photo mode as verification: "so that they can see if their
opponent really saw it." That framing leads somewhere expensive and
unsatisfying. A formal dispute flow needs a challenge action, a response
window, a resolution rule, an appeals story, and a decision about what happens
to a game where the challenged player never opens the app again. All of that
for a game two people play in the woods.

The actual social dynamic is lighter. People look at each other's photos
because they want to see the flower, and because a bad photo is funny. So:

- No challenge or dispute flow. There is no mechanism to reverse another
  player's mark.
- One reaction row on any square in another player's board, from a fixed set:
  a heart, a "nice", and one skeptical face. The skeptical face is the entire
  cheat-detection system and it is sufficient, because the only penalty anyone
  actually wants is being teased.
- The square's detail sheet shows a licensed reference photo of the item beside
  the player's own photo, same size, side by side. That comparison settles any
  real argument in one glance without a mechanism, and it is the reason the
  dispute flow is not needed. See [08-reference-photos.md](08-reference-photos.md).
- A photo counter on each player's row: "18 of 19 marks have photos". Social
  pressure works, enforcement does not.

Spend the saved effort on the Life List, which is what makes people take the
photo in the first place.

## Ending a game

A game ends when a player completes a win pattern, or when the creator ends it,
or at an optional end date.

Ties are a supported outcome, not an error state. See the arbitration rules in
[05-architecture.md](05-architecture.md#who-won). Both players get the full win
animation and both get the win recorded.

Optional ruleset variants worth having behind the rules toggle, in rough order
of value:

- **Keep playing after bingo.** Game continues to blackout, first bingo is
  recorded but the board stays live. Good for season-long games.
- **Double bingo.** Two completed patterns required. Roughly doubles game
  length.
- **Blackout.** All 24. The endurance version, right for a whole season.

## Item design, which matters more than rules

The quality of a game is the quality of its 24 items. Curated packs should
follow these rules and generated lists should be prompted to:

- **Mixed rarity.** Roughly 6 easy, 12 medium, 6 hard. A board of all-easy ends
  in an afternoon; a board of all-hard never ends. Store a 1 to 5 rarity on
  every item and enforce the spread at draw time, not at pool time.
- **Unambiguously identifiable by a non-expert.** "Spring Beauty" works.
  "Sedge" does not, because nobody can tell sedges apart and the mark becomes
  meaningless.
- **A hint line on every item.** "Trout Lily: mottled leaves, single nodding
  yellow flower." This is what lets a nine year old play an ephemerals board,
  and it is what turns the game into something that teaches.
- **No item that requires trespassing, danger, or harming the thing.** Never
  "pick a trillium". Say so in the generation prompt and in the pack
  submission rules.
