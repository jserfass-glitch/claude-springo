# 04 Design system

Clean, minimal, colourful, rounded. The way to get all four at once is a very
quiet chrome around very loud content. The board is the only saturated thing on
screen. Everything else is cream, ink, and air.

## Palette

Named after the flowers that started the game. Seven accents, one per active
game, so parallel games are told apart by colour before a single word is read.

Every accent ships as **three tokens**, because one hex cannot be a fill, a
label, and a dark-mode label at the same time:

- `fill` the saturated version, used for marked squares, chips, buttons
- `deep` the darkened version, used when the accent is text on a light ground
- `soft` the lightened version, used when the accent is text on a dark ground

| Flower | fill | ink on fill | ratio | deep | on cream | soft | on dark |
|---|---|---|---|---|---|---|---|
| Trout Lily | `#F0B040` | Loam | 7.76 | `#8A5A00` | 5.55 | `#FFC96B` | 11.75 |
| Spring Beauty | `#EE7FA8` | Loam | 5.82 | `#A8305C` | 6.06 | `#F7A8C3` | 9.64 |
| Mayapple | `#4FA968` | Loam | 5.09 | `#2A6E3C` | 5.79 | `#7FC793` | 8.92 |
| Hepatica | `#6FB4CE` | Loam | 6.42 | `#1F6280` | 6.31 | `#9AD0E3` | 10.63 |
| Bluebell | `#5566CC` | White | 5.05 | `#4353B5` | 6.26 | `#8E9AE4` | 6.71 |
| Redbud | `#9B4FB8` | White | 4.99 | `#7E3A99` | 6.66 | `#C08AD6` | 6.67 |
| Trillium | `#C0453E` | White | 5.05 | `#A63530` | 6.20 | `#DE7C76` | 6.16 |

Every ratio in that table clears WCAG AA at 4.5:1, measured, not estimated.
Note that the ink on a fill is **not constant**: yellow, pink, green and blue
take dark ink, while the violet, purple and red take white. Ship that as a
token pair (`accent.fill` + `accent.ink`) and never hardcode white text on an
accent.

Neutrals:

| Token | Light | Dark | Note |
|---|---|---|---|
| `ground` | `#FBF7F0` Bloodroot | `#1A1714` | page background |
| `surface` | `#FFFFFF` | `#262119` | cards, squares |
| `ink` | `#2B2722` Loam | `#FBF7F0` | 13.89 and 16.71 |
| `ink-muted` | `#6E6257` | `#A69A8C` | 5.54 and 6.48 |
| `hairline` | `#E8E0D4` | `#332C25` | 1px borders, never for text |

Dark mode is required, not a nice-to-have. Half of this app is used outdoors at
dawn and dusk.

**Do not tint the whole app with the game accent.** Tempting, and wrong: the
chrome has to stay stable when swiping between games or the app feels like it
is flickering between skins. The accent appears on the chip dot, the marked
squares, the primary button, and nowhere else.

## Shape

Rounded throughout, with radii that step rather than scale:

| Element | Radius |
|---|---|
| Sheets and modals | 28 |
| Cards, board container | 24 |
| Board squares | 18 |
| Chips, tags | 999 (pill) |
| Buttons | 999 (pill) |
| Photos in a square | 14, inset 2 from the square |

Borders are 1.5px at 14% opacity of the accent on unmarked squares, which reads
as a faint colour wash across an unplayed board and makes an empty game look
inviting rather than empty. Marked squares lose the border and take the fill.

Elevation is one soft shadow at most, `0 2px 12px rgba(43,39,34,.07)`. No
stacked shadows, no inner glows. The colour does the work.

## Type

Two families.

- **Display:** a geometric sans with soft, slightly rounded terminals. Nunito,
  Poppins, or Figtree. Used for the app title, screen headers, square labels,
  and numbers. The roundness of the letterforms is what carries "rounded" into
  places a border radius cannot reach.
- **Body:** the platform default, SF Pro on iOS and Roboto on Android. Nobody
  needs a custom font for a settings list, and the platform faces handle
  Dynamic Type correctly for free.

Scale:

| Role | Size / weight | Tracking |
|---|---|---|
| Screen title | 28 / 700 | -0.4 |
| Section header | 20 / 700 | -0.2 |
| Square label | 13 / 600, 2 lines max | 0 |
| Body | 16 / 400 | 0 |
| Meta and counts | 13 / 500 | 0.2 |
| Numeric stat | 34 / 800, tabular figures | -0.8 |

Square labels are the hard case. Item names run from "Dutchman's Breeches" to
"Moss". Set them 13/600 centred, two lines with an ellipsis, and vertically
centred in the square rather than top-aligned, so short and long names look
deliberate next to each other.

## Motion

This is where "attractive animations" is actually decided. Spring physics
throughout, not eased curves, because a spring is what makes a tap feel like it
had mass.

### Marking a square

The signature interaction. Four things happen at once over about 400ms:

1. **Press:** scale to 0.94 over 90ms while the finger is down.
2. **Release:** spring back to 1.0. `stiffness 260, damping 18, mass 1`. It
   overshoots to roughly 1.03 and settles, which is the whole feel.
3. **Bloom:** a radial fill in the accent colour expands from the exact touch
   point to cover the square in 280ms on an ease-out. Starting it at the touch
   point rather than the centre is a one-line change and it is the difference
   between "responsive" and "alive".
4. **Check:** a check mark draws as a stroke, `stroke-dashoffset` animated over
   260ms starting at 120ms. It draws, it does not fade in.

Plus a light haptic on release (`impactLight` on iOS, `EFFECT_TICK` on
Android), and on the sixth mark and beyond a very slight pitch rise in the
tick sound, so a board filling up sounds like it is filling up.

In photo mode the bloom is replaced by the photo scaling in from 1.08 with a
short blur-out, which reads as the picture landing in the square.

### Near a bingo

When a line is one square from complete, the remaining square breathes:
opacity 1.0 to 0.82 and scale 1.0 to 1.015, 2.4s per cycle, ease-in-out, with
the cycles of different squares offset so they do not pulse in unison.

Keep it that quiet. The simulation in
[02-game-rules.md](02-game-rules.md#the-one-away-state-lasts-longer-than-you-think)
shows a player is one away for an average of 5.2 marks, which in a season game
is days. Anything louder becomes wallpaper, then becomes irritating.

### Winning

About 1.6 seconds, skippable by tapping anywhere.

1. `0ms` the winning line lights square by square, 60ms apart, each scaling to
   1.08 and back with a white flash at 30% that decays.
2. `360ms` the whole board tilts about 3 degrees and lifts, as if picked up.
3. `420ms` a burst of petals and pollen motes in the game's accent colour,
   about 40 particles, thrown upward with gravity, rotating, fading out over
   1.1s. Petal shapes, not confetti rectangles. This is the one place to spend
   real polish.
4. `700ms` the word lands. Not "BINGO" set in a heavy display face, which is
   every other bingo app. Use the pattern name and the item that closed it:
   "Bingo on Bloodroot", with the flower name in the accent.
5. `1200ms` a card slides up with the win, the time it took, and a share
   button.

Losing needs a moment too, and it is usually forgotten. When an opponent wins,
show their winning line drawn across their board with the same sequential
lighting, then the final state of both boards side by side. Seeing the line
that beat you is the thing that makes you want to play again.

### Everything else

| Transition | Spec |
|---|---|
| Screen push | 280ms, `cubic-bezier(.32,.72,0,1)` |
| Sheet present | spring, `stiffness 300, damping 30` |
| Game swipe | follows the finger, spring settle on release |
| Chip badge appear | scale 0 to 1 with a small overshoot, 240ms |
| Opponent mark arriving live | square flips on Y over 380ms with a soft chime |
| List item enter | 24px rise plus fade, 40ms stagger, capped at 8 items |

### Reduce Motion

Every animation above collapses to a 120ms cross fade. The haptic stays, the
sound stays, the particles do not run at all. This is an accessibility
requirement, it is checked in store review, and vestibular disorders are common
enough that a particle burst can genuinely make someone ill.

## Iconography

Rounded stroke icons at 1.8px on a 24px box, matching the letterform roundness.
No filled icons except the chip dot and the tab bar's selected state.

**No emoji anywhere.** An earlier version of this section argued for emoji on
pack items, on the grounds that 24 pieces of custom illustration per pack is
unshippable at the rate packs get created. The constraint was real; the
conclusion was wrong. Emoji render differently on every platform, sit at a
different optical weight to the rest of the type, and read as clip art next to
a photograph of an actual plant.

What replaces them splits the job one emoji was doing into two channels, because
one glyph per category would collapse a flower pack into 24 identical blooms:

- **Shape says what kind of thing a square is.** Twenty-two glyphs cover every
  pack. For plants they are real identification characters, so the glyph is
  doing botany rather than decoration: `trio` for three petals, `bell` for a
  nodding bell, `spike` for a vertical cluster, `hood` for a spathe, `cluster`
  for a head of small flowers, `bloom` for an ordinary flower. The rest are
  `leaf`, `fruit`, `tree`, `fungus`, `bird`, `creature`, `water`, `stone`,
  `structure`, `vehicle`, `sign`, and for screen packs `person`, `speech`,
  `reveal` and `time`.
- **Colour says which square it is**, hashed from the item key into eight
  values, so a board of twenty-four flowers still reads as twenty-four
  different things.

That is what makes it scale: a pack supplies one word per item and gets a
distinct square, and a generated pack gets the same treatment for free because
the model picks from the same twenty-two names.

The eight icon colours, checked at 3:1 against their surface. That is the
non-text contrast threshold, which is the right one for a glyph; the 4.5:1 in
the palette table above applies to text.

| | Light | ratio | Dark | ratio |
|---|---|---|---|---|
| rose | `#C2456F` | 4.80 | `#F08CB0` | 7.06 |
| gold | `#9A6100` | 5.14 | `#F0B040` | 8.54 |
| moss | `#2F7A45` | 5.26 | `#6FC488` | 7.71 |
| sky | `#1F6E8C` | 5.73 | `#7FC4DC` | 8.42 |
| iris | `#4353B5` | 6.68 | `#93A0E8` | 6.55 |
| plum | `#7E3A99` | 7.11 | `#C48ADA` | 6.21 |
| ember | `#A63530` | 6.62 | `#E08A85` | 6.33 |
| bark | `#6B5442` | 7.07 | `#C0A386` | 6.86 |

A glyph on a marked square takes the accent's ink colour instead, and on a
square filled with the player's own photo it goes white with a drop shadow, so
contrast holds without a third palette.

Author these by rendering them and looking. Four of the twenty-two were wrong on
the first pass: `bell` read as a garden trowel, `leaf` as an almond, `bird` as a
bean, and the tree's trunk was too short to read as a trunk.

## The one aesthetic risk

A cream ground with seven bright accents and pill buttons is one styling
decision away from reading as a children's app. The brief says all ages, and
all ages does not mean toddler.

Three things hold it back from that edge:

- **Type restraint.** No outlined letters, no drop shadows on text, no more
  than two weights on any screen.
- **Spacing generosity.** Children's apps are dense and full. Leave large
  margins and let the board breathe.
- **Photographs.** The moment real photos of real flowers fill the squares, the
  app reads as a naturalist's tool that happens to be playful. That is the
  target, and it is why photo mode matters beyond the game mechanic.
