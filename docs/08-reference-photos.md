# 08 Reference photos

Can the app pull photos of the items from the internet? Yes, and the answer is
more interesting than a yes.

Everything in this document was measured by actually doing it. The fetcher is
`tools/fetch-references.py` and its output is the 24 images in
`prototype/ref/`, which the prototype serves.

## Where the photo goes

Not on the square face. In the square's detail sheet.

Three reasons, in order of weight:

1. **The square face is the souvenir.** A marked square fills with *your*
   photo. That is the single best free thing in the design, and a reference
   photo on the face collides with it.
2. **It gives away the answer.** A board where every square shows a picture of
   the thing is a matching exercise. A board of names with a hint line is an
   identification game, and identification is the part that teaches.
3. **Twenty-four photographs on one screen is visual noise**, which loses the
   clean and minimal half of the brief immediately.

So: tap a square, and the sheet shows the name, the scientific name, the
identification hint, the reference photo, and your own photo next to it.

**That side-by-side is the real verification feature.** Reference on the left,
what your opponent actually photographed on the right, at the same size. Anyone
can judge that in one glance. It is a better answer to "did they really see it"
than any dispute flow, it costs nothing to build once the sheet exists, and it
stays friendly rather than adversarial. This replaces the challenge mechanic
argued against in [02-game-rules.md](02-game-rules.md).

## Source: iNaturalist, not stock and not generated

**iNaturalist** is the right source for anything with a taxon. Its API maps a
scientific name to observations that a community of naturalists has
identified, each photo carries an explicit `license_code` and an attribution
string, and research-grade observations have been confirmed by at least two
people. Wikimedia Commons is a reasonable fallback.

**Not generic stock.** Searching "trout lily" on a stock site returns yellow
flowers that may be any of several species. For a game whose entire point is
identification, a confidently wrong photo is worse than none.

**Never AI-generated.** A generated spring beauty is a plausible flower that is
not *Claytonia virginica*. It will have the wrong petal count, the wrong leaf,
the wrong venation, and a nine year old will learn it. This is the one place in
the app where generated content is actively harmful rather than merely weak.

**Nothing automated for items that are not species.** A road trip pack's
"water tower" or "fireworks stand" has no taxon and a stock photo of one
teaches nothing. Leave those with no reference image and let the pack author
attach one if they want. The sheet already handles the empty case.

## Licensing, which is a real constraint

iNaturalist photos carry per-photo licences and many are **CC BY-NC**, which
forbids commercial use. If Springo ever charges for anything, NC images are a
problem, and retrofitting a licence filter after a pack library exists is
miserable.

Filter at fetch time to `cc0`, `cc-by`, `cc-by-sa` only. Never `null`, which
means all rights reserved. Store the observer name and licence code alongside
the image and render them under it, because BY and BY-SA both require
attribution and the credit line costs one line of UI.

Note that CC BY-SA carries share-alike obligations. If that is uncomfortable,
narrow the filter to `cc0` and `cc-by` and accept a lower hit rate.

## What the measurement showed

Three passes over the same 24 Ozark spring ephemerals.

| Pass | Method | Usable |
|---|---|---|
| 1 | Taxon default photo, open licences only | 21 of 24 |
| 2 | Add a fallback to research-grade observations | 24 of 24 |
| 3 | Add the flowering-phenology filter | 24 of 24, and far better |

**Pass 1 failed on licensing.** Three species had no commercially usable photo
anywhere in their curated set: Blue-eyed Mary, Wild Blue Phlox and Green
Dragon. Falling back to the observations endpoint, which searches a much larger
pool, found all three.

**Pass 2 failed on usefulness, which is the more important failure.** Seven of
twenty-four were correctly identified photographs of the right species that
were useless as references: Hepatica and Bishop's Cap and Rue Anemone and
Yellow Violet returned leaves with no flower, Pawpaw and Shooting Star returned
the wrong phase of the year. Every one of those is a true photo of the right
plant. None of them helps you find it.

**Pass 3 fixed most of that with one parameter.** iNaturalist annotates
observations with plant phenology, so `term_id=12&term_value_id=13` restricts
results to flowering. All 24 items matched, and the leaves-only results
disappeared.

**Roughly six of twenty-four are still weak.** Rue Anemone returns what looks
like a double-flowered garden cultivar rather than the wild plant. Pawpaw
returns a photograph of somebody's arm reaching for a branch. Virginia Bluebell
returns a white-flowered variant of a plant everyone knows as blue. Mayapple
returns a distant shot where the flower is a few pixels.

## The conclusion

Automated sourcing gets to roughly **75 percent usable**. No API parameter
fixes the rest, because "is this a good photo to learn the plant from" is a
judgment, not metadata. Sort order by favourites helps and does not solve it.

That is not an argument against automation. It is an argument for putting the
result in front of a person, which the design already does: **the creator
review screen** in [03-ux.md](03-ux.md) reviews the generated item list before
a game starts, and it should review the photo in the same pass. One image per
chip, a "next photo" control cycling through the open-licensed candidates, and
a skip. Reviewing 24 photos takes about a minute and takes the pack from 75
percent to 100.

The reviewed result is then cached on the pack and never fetched again, so the
cost is paid once per pack rather than once per game. That also keeps the app
inside iNaturalist's rate limits and off their bandwidth, which matters if this
gets popular: cache the images on your own storage, keep the attribution, and
do not hotlink.

## Practical notes

- Fetch at pack creation, never at board render. A board must open offline.
- Resize to 300px square and re-encode. The 24 images here total 462KB, which
  is small enough to ship inside a pack download.
- The re-encode drops EXIF from the reference images too, which matters because
  observation photos often carry the observer's GPS.
- Respect the rate limit and send a real User-Agent. iNaturalist asks for both
  and will block a scraper that ignores them.
