# 07 Roadmap

## Build order

The order matters more than the list. Each milestone should be playable by two
real people before the next one starts.

**M1, the paper card in an app (about 3 weeks).**
One device, no accounts, no network. Local SQLite, hardcoded Arkansas spring
ephemerals pack, board generation, marking, win detection, the tap animation
and the win animation. Nothing else.

The test: make a board, walk outside, and see whether the thing is fun alone.
If the animation on marking a square is not satisfying at M1 it will never be
satisfying, and this is the cheapest possible moment to find that out.

**M2, two people (about 4 weeks).**
Accounts, friends, game creation, invite by code and link, sync, opponent board
viewing, honor mode only, push notifications. Still one curated pack.

The test: two people who actually live together play a real season board.

**M3, photos and the Life List (about 3 weeks).**
Photo mode, the capture and compression pipeline, EXIF stripping, photos as
square fills, the Life List and its share card.

**M4, content (about 3 weeks).**
The twelve curated packs, generated lists with the creator review screen, pack
saving and sharing, rate limits.

**M5, the rest (about 3 weeks).**
Multi-game tabs, achievements, friends leaderboard, per-pack leaderboards,
stats screen, report and block.

Roughly four months to a shippable v1 for one competent mobile developer.
Add a designer for the win animation and the particle work in M1 and the Life
List share card in M3.

**Deliberately after v1:** random matchmaking and everything it drags with it
(matchmaking service, moderation queue, age gating enforcement, abuse tooling,
stranger-safe display names). That is another six weeks and an ongoing
operational cost, and it should be paid only once the friend game has proven
people want this.

## Costs

The three that scale, at a hypothetical 10,000 monthly active users:

| Line | Estimate | Note |
|---|---|---|
| Photo storage | around 1TB/year | at 400KB and 13 photos per finished game, 20 games/user/year |
| Photo egress | the larger bill | pick a provider with free or cheap egress, this is where it hurts |
| List generation | small, and capped | a few cents per generation, rate limited per user per day |
| Supabase | one paid tier | the row counts here are trivial for Postgres |

The retention rule in [05-architecture.md](05-architecture.md#photo-pipeline)
(full resolution kept 90 days past game end, permanently only for Life List
photos) is what keeps the first two lines flat rather than cumulative. Decide
it before launch, because adding a deletion policy to photos users already have
is a support problem.

## Monetisation, briefly

Not asked for, but it shapes two design decisions so it needs a position.

Free: the whole game, unlimited games with friends, all curated packs,
unlimited replays, the Life List.

Paid, a small one-off or a cheap annual: custom list generation beyond the free
daily allowance, private pack creation beyond a handful, the Life List poster
export at print resolution, and extra board themes.

The rule is that **nothing that affects who wins is ever paid.** A game where
one player bought something the other did not is a game not worth playing, and
this particular app lives entirely on two people trusting the same board.

Avoid ads. An interstitial between "I saw a trillium" and "the square is
marked" would be a genuinely bad thing to do to a nine year old outside with a
parent.

## Open questions

These need an answer from you, not from me, because they are product taste
rather than engineering.

**1. Does a game need an owner after it starts?**
If the host abandons a season-long game, can another player end it, or does it
sit active forever? Suggest: any player can end a game after 30 days of no
marks from anyone, and the game records whoever had the most squares.

**2. How much does a stranger see?**
In a random game, does the opponent see your handle, your Life List count, your
achievements? Suggest: handle and the current game only, nothing else, with a
profile that opens up on friending.

**3. Should packs be a marketplace or a garden?**
A public pack directory with ratings turns pack creation into a content
economy, which is real growth and real moderation. A private-by-default,
share-by-link model stays small and safe. Suggest starting with share-by-link,
and only opening a directory once there is someone to moderate it.

**4. Is there a co-op mode?**
The origin story is two people marking the same card together, which is
cooperative, not competitive. A shared board where both players fill one card
is a different and possibly better game, and it is about a week of work on top
of what is here. Worth prototyping in M2 rather than assuming competition is
the point.

That last one is the most interesting question in the whole brief. The game you
that started this, two people filling cards together, was not really a race.
