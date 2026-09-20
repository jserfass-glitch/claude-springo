# 04 Design system

Clean, minimal, colourful, rounded. The way to get all four at once is a very
quiet chrome around very loud content. The board is the only saturated thing on
screen. Everything else is cream, ink, and air.

## Palette

Named after the flowers that started the game. Seven accents, one per active
game, so parallel games are told apart by colour before a single word is read.

Every accent ships as **four tokens per theme**, because one hex cannot be a
fill, a label, and a dark-mode label at the same time:

- `fill` the saturated version, used for marked squares, chips, buttons
- `ink` the text that goes **on** the fill, which is not constant
- `deep` the accent as text on that theme's surface
- `soft` the lightened version, used only for the win confetti

Each accent therefore carries a light set and a **dark set**. That is not
decoration. `deep` is a text colour, and a single light-mode `deep` such as
`#8A5A00` lands at **2.75:1** on the dark surface, which is exactly what the
selected tab label, the live pill and the free-square glyph are drawn in. Read
accents through `accentOf()` in `app/app.js`, never straight out of `ACCENTS`,
or the dark set is skipped.

| Flower | light fill | ink | ink:fill | light deep | on paper | dark fill | ink:fill | dark deep | on dark |
|---|---|---|---|---|---|---|---|---|---|
| Trout Lily | `#E89C1C` | ink | 7.44 | `#7A4A00` | 7.36 | `#F0B040` | ink | 8.89 | `#FFC259` | 10.35 |
| Spring Beauty | `#E05A8B` | ink | 4.86 | `#A02755` | 7.08 | `#F08CB0` | ink | 7.34 | `#F7A6C2` | 8.83 |
| Mayapple | `#3E9D57` | ink | 4.99 | `#1F5E31` | 7.64 | `#6FC488` | ink | 8.03 | `#88D39E` | 9.36 |
| Hepatica | `#4FA7C6` | ink | 6.21 | `#145E7C` | 7.07 | `#7FC4DC` | ink | 8.76 | `#95D3E8` | 10.07 |
| Bluebell | `#4B5CC4` | white | 5.79 | `#3A46A2` | 8.01 | `#93A0E8` | ink | 6.82 | `#A9B4F0` | 8.27 |
| Redbud | `#9243B0` | white | 5.75 | `#6E2F87` | 8.54 | `#C48ADA` | ink | 6.46 | `#D4A2E6` | 7.98 |
| Trillium | `#BC3C34` | white | 5.48 | `#932A26` | 7.95 | `#E08A85` | ink | 6.58 | `#E8A19D` | 7.91 |

Every ratio above is measured, not estimated, and clears AA at 4.5:1. Note
that ink on a fill is **not constant**: in light mode the violet, purple and
red take white while the rest take ink, and in dark mode every fill is light
enough to take ink. Ship that as a token pair (`fill` + `ink`) and never
hardcode white text on an accent.

Each fill also clears **1.9:1 against its own ground**, which is the threshold
that decides whether a marked square reads as a filled shape at arm's length
in daylight. AA says nothing about that case, so it is a house rule.

Neutrals:

| Token | Light | on surface | Dark | on surface |
|---|---|---|---|---|
| `ink` | `#1F1C17` | 16.70 | `#FBF7F0` | 15.52 |
| `ink-muted` | `#564C42` | 8.24 | `#BCAF9C` | 7.70 |
| `hairline` | `#C2B49B` | 2.01 | `#514735` | 1.82 |

`ground` is `#F2EBDC` light and `#13110E` dark; `surface` is `#FFFDF8` and
`#221E18`. The paper is deliberately a deeper cream than white so that cards
and squares separate from it without a shadow doing the work.

`hairline` is never text. Its job is to be a visible edge, so it is held above
**1.8:1** rather than 4.5:1, and borders are 2px, not 1px. On a poster the
rules are part of the drawing.

Dark mode is required, not a nice-to-have. Half of this app is used outdoors at
dawn and dusk.

Light is the base palette: it lives in the bare `:root`, and dark arrives
through `prefers-color-scheme` and through an explicit `[data-theme="dark"]`.
The You screen carries an **Appearance** control with Auto, Light and Dark,
because following the phone is the right default and overriding it is the right
escape hatch, and because a paper-coloured app is the one people want to show
someone in the field. The choice is stored in `localStorage` and applied by an
inline script in `<head>`, so a forced theme never flashes the other one first.

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

The reference is a 1930s WPA national-park poster: condensed gothic capitals,
letterspaced, over flat colour. Two families, both self-hosted.

- **Display: Oswald.** The closest thing on Google Fonts to the Alternate
  Gothic lettering those posters were set in. Screen titles, section headers,
  buttons, tab labels, chips, card titles, numerals, and square labels. Set
  uppercase with positive tracking almost everywhere; the tracking is what
  separates "poster" from "cramped".
- **Body: Archivo.** A squarish grotesque that holds up at 12px, which Oswald
  does not. Running text, hints, option descriptions, input values.
- Monospace is kept for game codes, photo credits and byte counts only, where
  the tabular figures earn it.

Both are **self-hosted** in `app/fonts/` and listed in the service worker
shell. They are not loaded from Google. The app has to open in a hollow with
no signal, the worker only caches same-origin, and the type now carries the
whole look, so a cross-origin font would have meant falling back to Helvetica
exactly when the design matters most. Two variable files, 56KB total, SIL OFL
1.1, notice in `app/fonts/OFL-NOTICE.txt`.

Scale:

| Role | Size / weight | Tracking | Case |
|---|---|---|---|
| Screen title | 24 / 600 display | .06em | upper |
| Section header | 19 / 600 display | .07em | upper |
| Button | 15 / 600 display | .07em | upper |
| Field label | 13 / 500 display | .13em | upper |
| Tab label | 11 / 500 display | .09em | upper |
| Square label | 10 / 500 display, 2 lines max | .02em | upper |
| Body | 16 / 400 body | 0 | sentence |
| Numeric stat | 46 / 700 display, tabular figures | 0 | n/a |

Square labels are the hard case. Item names run from "Dutchman's Breeches" to
"Moss". Condensed uppercase turned out to help twice over: it looks like a
field-guide plate, and it fits roughly a third more characters per line than
the mixed-case rounded sans it replaced, so fewer names truncate.

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

The eight icon colours. 3:1 is the WCAG non-text threshold and the right one
for a glyph, but every value below clears 6:1, for the reason under the table.

| | Light | ratio | Dark | ratio |
|---|---|---|---|---|
| rose | `#AE2F5C` | 6.15 | `#F599B9` | 8.00 |
| gold | `#8A5600` | 6.05 | `#F5BB55` | 9.57 |
| moss | `#266838` | 6.62 | `#7FD196` | 9.05 |
| sky | `#195C77` | 7.28 | `#8FD0E6` | 9.73 |
| iris | `#3A46A2` | 8.01 | `#A3AEF0` | 7.79 |
| plum | `#6E2F87` | 8.54 | `#D09AE4` | 7.44 |
| ember | `#932A26` | 7.95 | `#E89A95` | 7.49 |
| bark | `#5A4636` | 8.74 | `#CDB093` | 8.07 |

These sit well above the 3:1 floor on purpose. A 2px stroke at exactly 3:1
reads as decoration; at 6:1 it reads as ink.

A glyph on a marked square takes the accent's ink colour instead, the free
square included once it is marked, and on a
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
