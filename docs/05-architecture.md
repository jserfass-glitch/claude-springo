# 05 Architecture

## Stack

**Client: Expo / React Native.**

The comparison worth having is against Flutter, which is the stronger choice on
pure animation control and on single-binary consistency. It loses here for
three reasons:

1. The backend and auth story in JavaScript is substantially better. Supabase,
   the photo pipeline, and the generation call are all first-class in JS and
   second-class in Dart.
2. Reanimated 3 plus Skia covers every animation in
   [04-design-system.md](04-design-system.md) comfortably. Springs, the radial
   bloom, the particle burst, and the stroke-drawn check are all routine. This
   brief does not need Flutter's ceiling.
3. EAS handles builds, credentials, and store submission for a small team, and
   OTA updates mean a rules bug found in April can be fixed in April rather
   than after a review cycle. For a seasonal app that is a real advantage.

Pick Flutter instead if the team already writes Dart. Do not pick native twice;
there is nothing in this app that needs it.

Key libraries: `react-native-reanimated`, `@shopify/react-native-skia` for the
particle burst and the radial bloom, `expo-camera`, `expo-image-manipulator`,
`expo-sqlite`, `expo-notifications`, `expo-haptics`, `expo-file-system`.

**Backend: Supabase.**

- Postgres for everything relational, which here is almost everything.
  Leaderboards, the Life List, stat rollups and achievement checks are all SQL.
  In Firestore each of those becomes a denormalised counter document and a
  fan-out write, and the Life List in particular ("every distinct item this
  user has ever marked, with a count and a best photo") is a `group by` in
  Postgres and a nightmare in a document store.
- Row Level Security answers "may I see your board" declaratively, at the
  database, instead of in fifteen places in application code.
- Realtime for live board updates while both players have the app open.
- Storage plus signed URLs for photos.
- Edge Functions for list generation and for win arbitration, which are the
  only two pieces of logic that must not run on a client.

Firebase's one genuine advantage is built-in offline persistence. That matters
less than it looks, because the custom offline work here is photo queueing and
win arbitration, neither of which Firestore does for you.

## Offline is the architecture, not a feature

One structural rule, and every other offline behaviour falls out of it:

> **No screen ever awaits the network.** Every screen reads from local SQLite.
> The network layer only fills SQLite and drains an outbox.

This is worth enforcing with a lint rule. The moment one screen does a
`await fetch()` in a render path, offline mode becomes a mode that mostly works
instead of a property of the app.

```
  UI  ──reads──▶  SQLite  ◀──writes──  sync worker  ◀──▶  Supabase
   │                 ▲
   └──writes────▶  outbox
```

**What is cached at game start:** the pack items with hints and emoji, the
board seeds for every player, the rules, and the player roster. That is a few
kilobytes. Every player's board can be regenerated from
`(game_seed, player_id)` so nothing about the grid needs syncing.

**What happens offline:** marking, unmarking, photo capture, browsing your own
board and any cached board, win detection, and the Life List. Everything except
seeing an opponent's marks made while you were both offline.

**What the outbox holds:** mark events, unmark tombstones, and photo upload
jobs. Marks are tiny and go first; photos drain afterwards on unmetered
connections by default, with a "upload now" control.

Marks are **append-only facts**, never mutable rows, which is what makes the
merge trivial. Two clients marking the same square is not a conflict, it is two
identical facts. Unmarking is a separate tombstone with its own timestamp and
last-write-wins. There is no case in this app where two offline devices produce
a genuine conflict, and that is a design property worth protecting.

## Who won

The hard problem, and the one the brief does not address.

Two players are in a hollow with no signal. Both complete a bingo. One reaches
a tower at 4pm, the other at 7pm. Who won?

**Ordering by server receipt time** means the player with worse signal always
loses. That is exactly the person offline mode exists for, so it is
unacceptable.

**Ordering by device wall clock** is trivially cheated. Set the phone back two
hours, mark the winning square, win.

**The answer: bounded client time.**

On every successful sync the client stores an anchor:

```ts
type SyncAnchor = {
  id: string;              // server-issued, unguessable
  serverTime: number;      // server's clock at sync
  monotonicAtSync: number; // device uptime counter, not wall clock
};
```

Every mark is stamped as `anchor.serverTime + (monotonicNow - anchor.monotonicAtSync)`
and carries the anchor id. The monotonic counter is device uptime, which the
user cannot set backwards without rebooting, and a reboot invalidates the
anchor.

On receipt the server checks that the claimed timestamp falls between the
anchor's server time and the moment of receipt. Inside that window, the client
timestamp is accepted as `effective_ts`. Outside it, the mark is clamped to
receipt time and flagged.

Then the part that matters socially:

> **If two winning marks land within 5 minutes of each other, or if either was
> clamped, the game is a tie and both players win.**

In a game about looking at flowers with your spouse, a tie is a fine outcome
and a dispute is not. Both get the full win animation, both get the win
recorded, and nobody has to be told the app decided they lost by ninety
seconds of cell coverage.

Tighten this only for random-opponent games, where the incentive to cheat is
real and a tie feels unearned. There, use a 30 second window and let clamped
marks lose. The rule difference should be stated on the game creation screen in
one line.

Arbitration runs in an Edge Function, never on a client, and writes
`games.winner_ids` as an array precisely because ties are expected.

## Photo pipeline

This pipeline is implemented for real in `prototype/`: photo mode there
opens the device camera, and the sheet reports the actual byte counts at each
step. Reference imagery for pack items is a separate pipeline, in
[08-reference-photos.md](08-reference-photos.md).

Capture, then five steps before anything leaves the phone:

1. **Strip EXIF entirely.** Client-side, before the file is written to the
   outbox, and again server-side on receipt. A photo of a wildflower carries
   the GPS coordinates of a place that person visits regularly. This is not
   optional and it is not a setting. Drawing the image to a canvas and
   re-encoding drops every metadata block as a side effect, so the resize in
   step 2 is also the EXIF step; do not skip the re-encode for an
   already-small photo.
2. **Resize** to 2048px on the long edge.
3. **Compress** to JPEG quality 0.75, landing around 300 to 500KB.
4. **Generate a 400px thumbnail** locally for the board view, so a board of 24
   photos costs about 1.5MB to display instead of 12MB.
5. **Queue.** The original stays on device in app storage until the upload
   confirms, then only the thumbnail is retained locally.

**Implemented** in `netlify/functions/springo-photo.mjs`, with one decision the
design above did not anticipate: **only the thumbnail syncs.** The 400px square,
about 30KB, is what crosses the wire; the 2048px original stays on the device
that took it. A board of 24 originals is roughly ten megabytes and a board of
thumbnails is under one, and the place this app has to work is the place with
one bar. At 400px in a 160pt frame nobody can tell.

Marks and photos drain on separate paths for the same reason a mark lands before
its upload finishes: a mark is a fact, a photo is an attachment. A photo that
fails to upload waits in the outbox and never blocks a mark, a win, or another
photo.

Storage cost is the line item that quietly kills consumer apps like this.
At 400KB average and 13 photos per finished game, a user playing twenty games
a year generates about 100MB. Ten thousand active users is a terabyte a year,
which is small money on R2 or B2 and considerably less small on some
alternatives. Plan the retention rule up front: **full resolution is kept for
90 days after a game finishes, and permanently only for photos promoted to the
Life List.** Everything else drops to the thumbnail. Say so in the privacy
copy.

Moderation, for when random matchmaking ships: every photo in a
non-friend game passes automated classification before the opponent can see it,
with an "processing" state on the square in the meantime. Friend-game photos
are classified asynchronously and only pulled on a hit or a report.

## List generation

**Implemented** in `app/` and
`netlify/functions/springo-generate.mjs`.

A server function, never a direct client call, so the key stays server-side and
the rate limit is enforceable.

Input: theme text, optional region, optional season, requested count.
Output: 30 to 40 items, each with a label, a one-line identification hint, an
emoji, and a rarity from 1 to 5.

Constraints the prompt must carry:
- observable in public, without trespassing, digging, picking, or handling
- identifiable by a non-expert given the hint
- a rarity spread of roughly 25% easy, 50% medium, 25% hard
- regionally accurate when a region is supplied, and it should say so when it
  is unsure rather than inventing a species

The output is **never** used directly. It lands on the creator's review screen
as chips, and the creator's edits are what become the pack. That single screen
is the entire defence against wrong facts, impossible difficulty, and abusive
themes, and it is the reason this feature is shippable at all.

Two implementation notes worth keeping. The model returns a `usable` flag and a
reason, so a theme that cannot make a safe findable board is declined by the
model rather than by a keyword filter of yours. And the schema is enforced with
a structured output format rather than parsed out of prose, so a malformed list
is an error at the boundary instead of a broken board three screens later.

Rate limiting: a handful of new generations per user per day, unlimited replays
of existing packs. Cache aggressively on a normalised `(theme, region, season)`
key, because "spring ephemerals arkansas" and "Arkansas spring ephemerals"
should not be two generations.

## Sync protocol

Simple, because append-only events make it simple.

```
POST /sync
  { since: <cursor>, events: [ ...outbox ] }
  ->
  { cursor: <new>, events: [ ...events from others ],
    anchor: { id, serverTime }, wins: [...] }
```

One endpoint, called on app foreground, on network regain, on a push, and on
pull-to-refresh. Realtime subscriptions are a live-view optimisation layered on
top, not the source of truth. If the socket never connects the app still works
perfectly, one sync behind.

Cursor is a server sequence number per game, not a timestamp, so it is
monotonic regardless of clock behaviour.
