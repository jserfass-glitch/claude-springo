# 01 Product

## What the app actually is

A shared observation game. Not a match-based multiplayer game with a bingo
skin on it.

The distinction drives most of the design:

| Match-based bingo | Springo |
|---|---|
| Session lasts minutes | Game lasts days or weeks |
| Both players in the app at once | App is closed almost all the time |
| Turn timers, lobbies, "waiting for opponent" | None of these exist |
| The screen is the game | The woods are the game, the screen is the scorecard |

Because the app is mostly closed, **the push notification is the product
surface that matters most.** "Sarah found Bloodroot" on a lock screen is what
pulls someone back outside. Design that message with the same care as the home
screen.

## Who it is for

Three groups, in order of how well the design serves them:

1. **Pairs and small groups who are physically together.** The origin case.
   Two people in the same woods with the same list. Everything works for them.
2. **Friend groups spread out.** A family on a road trip in two cars, cousins in
   different states doing a backyard birds board. Works, but boards should be
   set to "varied" so they are not hunting an identical list in different
   biomes.
3. **Strangers.** The random-opponent case. Works mechanically, but carries
   nearly all of the safety, moderation, and abuse cost in the product. See
   below.

Age range: the mechanic genuinely works for a six year old on a road trip and
for an adult botanist. The **content** is what scales across ages, not the
rules. A "road trip" pack and an "Ozark spring ephemerals" pack are the same
game.

## Safety

**Decided: the app is rated 13+.** That resolves the sharpest tension in the
original brief, which asked for all ages, random opponents, and user
photographs at the same time. Photo sharing between unconnected strangers in an
app rated for young children fails store review on both platforms, and the
underlying risk is the exact pattern child-safety review exists to catch.

A 13+ floor is worth more than it looks, because it removes an entire
compliance regime rather than just moving a number:

- **No COPPA.** COPPA applies to users under 13. With a 13+ floor there are no
  under-13 accounts, so there is no verifiable parental consent flow, no
  parent dashboard, no separate data-retention regime, and no friends-only
  child mode to build and enforce. That was the single largest compliance cost
  in the brief and it is now gone.
- **13+ is a real App Store tier.** Apple replaced 12+ and 17+ with 13+, 16+
  and 18+ in 2025, alongside 4+ and 9+, so the rating maps directly rather
  than rounding to a neighbouring tier. Google Play's equivalent is Teen.
- The content itself was never the problem. Looking at flowers is 4+ content.
  The rating exists to gate *who a player can be connected to*, which is the
  correct reason to have one.

**Still required at 13+:**

- **Random matches are Honor mode.** No photos between people who are not
  friends, full stop. This holds for v1 and v2; photo play with strangers is a
  later decision that needs a moderation queue behind it, not a toggle.
- **No free text between non-friends.** Reactions from a fixed emoji set only.
  Display names in stranger games are handles, chosen from a safe generator by
  default.
- **Strip EXIF on every upload, in every mode.** Location metadata on a photo
  of a wildflower is the location of a place that person visits repeatedly. Do
  it client-side before the bytes leave the device, and again server-side. A
  canvas re-encode drops all metadata as a side effect, which is why the
  resize step in the photo pipeline is also the EXIF step.
- **Report and block on every player row and every photo**, with the blocked
  player's boards and photos disappearing immediately for both parties.
- **A birth-year gate at signup**, enforced server-side. Not a full date of
  birth: the year is enough to gate on and is materially less sensitive to
  hold.

What remains is ordinary teen-social-app hygiene rather than a child-safety
programme. The reason to still cut random matchmaking from v1 is now cost and
validation, not safety: matchmaking, a moderation queue and abuse tooling are
about six weeks, and nobody has yet confirmed people want to play this with
strangers at all.

## Leaderboards, reconsidered

A global "most wins" board is farmable in minutes. Create a private game themed
"things in my kitchen", invite an alt account, win in four minutes, repeat.
Every ranking based on a count of self-created games has this problem.

Ship instead:

- **Friends leaderboard, seasonal.** Resets quarterly so a friend who played
  hard one spring does not sit on top forever. Ranks by wins, with games played
  shown alongside so a 3-from-4 reads better than 5-from-40.
- **Per-pack leaderboards.** "Fastest bingo on Arkansas Spring Ephemerals",
  "most squares filled". Bounded, comparable, and it drives pack engagement,
  which drives pack creation, which is the content engine.
- **No global wins board.** If a global number is wanted later, use a rating
  that only counts games against non-friends with three or more players, and
  weight it by pack difficulty.

State the ranking rule in the UI. People tolerate a leaderboard they
understand.

## Seasonality, the retention problem

Spring ephemerals bloom for about six weeks. A nature-observation game has a
natural annual shape, and the flagship theme has the narrowest window of any of
them. Left alone, this app peaks in April and flatlines in June.

Three counters, in order of strength:

1. **The Life List.** A lifetime record of everything you have ever found,
   with your own photos, is worth opening in any month. It also converts photo
   mode from friction into collection, which is the only framing under which
   people reliably take the photo.
2. **Pack breadth from launch.** Ship at least twelve curated packs spanning
   the year: road trip, backyard birds, fall fungi, city walk, beach day,
   winter tracks, farmers market, night sky, state fair, holiday lights,
   airport, hardware store. Some should be silly. The silly ones carry the
   off-season.
3. **Long games.** A game with no end date that runs all summer, with one or
   two marks a week, is a perfectly good product. Do not add a turn timer or
   an expiry that forces closure.

## v1 scope

**In:**
account and friends, create game from a curated pack or a reviewed generated
list, both modes, offline marking, opponent board and photo viewing, win
detection with tie handling, Life List, multi-game tabs, eight achievements,
friends leaderboard, report and block.

**Out of v1:**
random matchmaking, global leaderboard, public pack marketplace, chat, group
games above six players, achievements beyond the first eight, web client.

**Deliberately never:**
turn timers, energy or lives, anything that punishes a player for being
outside.
