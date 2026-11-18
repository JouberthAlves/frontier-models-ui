# Revisão da v2, rodada 1 (Opus xhigh, 2026-11-18)

## Review: frontier-models-ui, spec-v2 ("Corrida até o céu")

### What passed
- **Build and lint:** `npm run build` and `npm run lint` are both clean (no errors, no warnings).
- **Server:** the preview ran on port 4790 and is stopped. The port is free.
- **GPU:** headless Chrome had a real GPU (ANGLE on Intel UHD 770), so the Galaxy shader was mounted.
- **No-GPU pass:** I also ran one with `--disable-gpu`/swiftshader. Galaxy stays off, the planets do not spin, the CSS stars fade in with T, the planets still arrive, and there were no errors.
- **Loader:**
  - Progress is real and announced: count 0→5 and the status text "Carregando N de 5".
  - All lamps go out together and the screen fades.
  - It closed in 1.3–2.4 s locally, 5.1 s on a throttled network (1.5 Mbps) and 4.8 s with software GL. All are under the 12 s cap.
- **Horizontal overflow:** none at 375, 768, 1024, 1440 or 1920. Page width always equals the window width.
- **Map SVG element count:**

| Width | Elements | Pieces |
|---|---|---|
| 1440 | 493 | 297 |
| 1920 | 595 | 400 (cap) |
| 2560 | 594 | — |
| 1024 | 272 | — |
| 375 | 196 | — |

  All are under the 650 cap. The separate `.race-fx` SVG adds 450–594 more elements (150–198 chunks).
- **Track geometry:**
  - y never decreases along the path. The only back-step I measured (−4 px) comes from my own check joining the two drawn slices, which overlap by one sample. The code clamps y.
  - No tree or house sits on the road, and none overlaps a content block.
  - The road never enters a block at 768, 1024, 1099, 1440, 1920 or 2560.
  - Cars sit 0–4 px from the centre line of the road.
- **Cars:** 5 cars, matching the 5 current Orbitarium runs in `archive.json`.
- **Scroll behaviour:** scrolling back to the top puts the cars back on the exact grid pixels and hides the planets again (opacity 0, sky 0). Jumping straight from the top to the Orbitarium gives the same planet state as scrolling there step by step.
- **Reduced motion (1440):** cars parked on the grid, nothing breaks up, planets visible, Galaxy off with CSS stars, and the warning banner shows after scrolling.
- **Contrast on the cream cards:**
  - navy-2 text: 7.05–7.32
  - `--link-warm` "Jogar": 4.58 / 4.75
  - S-number labels: 4.75
  - navy: 16.6–17.2
- **Contrast on the hero, measured against the map pixels behind it:** supporting text 5.5, stats 13, secondary button 13. The primary button is #1a0f08 on #fdaf6d.
- **Banned ranking words:** none in `src/` or `dist/`.
- **Console, images, language:**
  - Console errors and page errors: none.
  - Images: 21, none broken; responses were all 200 or 304.
  - The PT/EN switch works: `lang`, title, description, nav, scene names, "The 6 games", and `localStorage fm-lang`. The track is rebuilt to the new block rectangles and still stays clear of the blocks.
- **D3 hover (scrambling names):** it scrambles and resolves left to right. Mixed colours are used on cream and pure model colours on the dark sections. The real text stays available as `.sr-only` with the effect `aria-hidden`. Card height never changes; on the 6 game cards the name width is also stable (103.4 / 181.6 px).

### P0 (broken)
None.

### P1 (wrong vs spec or ugly)

1. **Hard seam on the road beside "Os 6 jogos", at every width.** Where the breakable last stretch begins (~640 px before the finish), the road ends with a square cut. Below that, the road looks washed out for about 220 px.
   - Where: 1440 at doc y≈3319 (screenshot 08, view y≈530); also at 768 and in the reduced-motion overview.
   - Cause: in `src/components/race/RaceMap.tsx`, the tail group (lines 445–468) is drawn first. The body's grass band, `<rect fill="url(#rm-ground-body)">` at line 471, is opaque grass at that point and fades out over 220 px, and it is painted on top of the tail road. The body tint at line 506 also covers it.
   - Fix: move the line-471 rect (and the line-506 body tint) before the `<g ref={tailRef}>`, so the band sits under the tail road. Then the two road slices join seamlessly. Optionally overlap the slices by 8 px.

2. **The break-up looks like confetti on an intact road, not the track breaking.** Grey, white and red squares (5–13 px) appear on top of the road, which is still whole. Bright green "leaf" squares appear over the darkened grass, glowing because they are above the dusk tint.
   - Where: `RaceMap.tsx:289-303` and `scenery.ts:383-421`; screenshots 1440-10 and 1440-11, 375-11.
   - Fix:
     - Fade the tail road out at the same moment chunks appear, e.g. tail opacity `1 - smooth(T/0.3)` instead of `(T-0.2)/0.55`.
     - Make the asphalt chunks larger and irregular (12–24 px polygons tiled along the road), so they replace the road rather than sit on it.
     - Tint leaf and roof chunks with the dusk colour at their y (or draw them under a tint layer).

3. **All 5 cars pile up on top of each other at the end of the road** before the zero-g flight.
   - Where: 1440 at scroll ≈3930 (screenshot 11), 375 (screenshot 375-11), 1024.
   - Cause: `RaceMap.tsx:318` uses `ease()` (ease-in-out cubic) on the flight progress. A car barely moves for the first ~20% of `floatSpan` (~230 px of scroll) while the next cars reach the road end.
   - Fix: use an ease-out or linear start (e.g. `t = 1 - (1-u)^2`, or smoothstep only on the last part). The car should leave the road at roughly scroll speed and keep the 58 px spacing.

4. **The scenery is much poorer than the approved mockup.**
   - What it looks like: small (~30 px), evenly spaced "polka-dot" trees. The village is a few scattered terracotta rectangles with stray dashed fences (they read as glitches). The "cliff" is a 15 px tan line across the whole page, which reads as a second dirt road running under the track and the cards. The large grass patches are perfect flat ellipses that read as holes.
   - Where: 1440 screenshots 03–07 and the overview images.
   - Fix (in `src/lib/scenery.ts` unless noted):
     - Scale pieces 1.4–2× at ≥1100 px (line 349 sets `s: 0.84 + v*0.4`) and grow trees in groves of 3–6 around seed points instead of single darts (lines 309–351).
     - Pack houses in rows around the plaza (lines 222–230, 341–345) and use fences only along the plaza or house edges.
     - Draw the cliff as a filled sand-2 step with a shadow band, broken where the road crosses (lines 211–220, `RaceMap.tsx:481-482`).
     - Use soft irregular blob paths for the patches (lines 197–209).

5. **Mobile (375) map is almost empty:** only 11 pieces over the whole 5,655 px map; the spec asks for about 40% of desktop density.
   - Cause: `scenery.ts:281` uses a 125 px spacing below 768, and line 321 excludes the whole `hero__inner` box, which is the full width on phones.
   - Fix: spacing ~70 px with scale ~0.75 below 768, and exclude only the real text and button rectangles of the hero rather than its whole box.

### P2 (polish)

6. **The road starts as a square stub just under the nav** (y=98), with the grid cars right at its end.
   - Where: `track.ts:121-126`; screenshot 1440-01.
   - Fix: add a waypoint at y≈−60 so the road enters from the top edge, as in the mockup.

7. **The sea is mostly hidden behind the nav.** It is at most ~104 px deep, of which the nav covers 64. In the mockup the sea is a major top-right feature.
   - Where: `scenery.ts:155-161`.
   - Fix: allow 160–240 px of depth (and the corner) on the side away from the hero text.

8. **The bridge barely shows.** It is drawn under the road (`RaceMap.tsx:488-500`), so only two small brown edges are visible, and at 768 the river is hidden at the crossing.
   - Fix: draw a plank deck the width of the road, with rails, after the road at the crossing, and hide the kerbs on the bridge.

9. **Phones: cars show as 6 px slivers along the card edges for long stretches.** Beside the 2,550 px games card that lasts about 2.5 screens.
   - Where: road centre at x=17 (`track.ts:79`); screenshots 375-03 and 375-08.
   - Fix: below 768, hide cars (opacity 0) while their centre is inside a block rectangle. Precompute a covered/uncovered table per track sample at layout time, so the per-frame lookup is cheap.

10. **At 1100 px the road runs half behind the full-width stage card and the cars are cut in half by its edge.**
    - Cause: the side margin is 44 px but the road is 54 px wide. This is allowed by the spec, but it looks bad.
    - Where: 1100 screenshot x2.
    - Fix: below ~1250 px use the 44 px road, or widen the gutter to ≥72 px for full-width blocks (`track.ts:68`, `:110`).

11. **The minimum curve radius drops below the 90 px desktop target** at some widths: 77 px at 1100, 89 at 1920, 79 at 2560. 1440 is fine at 91.
    - Fix: raise `controlFactor` (`track.ts:152`) or reduce the bend amplitude when the computed radius is under 90.

12. **At 375 the road's right kerb is cut off by the screen edge.**
    - Cause: `edge = roadW/2 + 2` ignores the 5 px kerb (`track.ts:79`).
    - Fix: `roadW/2 + 5 + 2`.

13. **At 375 the grandstand touches the right finish flag.**
    - Cause: the stand is at `roadW/2 + 10` (`scenery.ts:271`) and the flag at `roadW/2 + 12` with a 15 px cloth (`RaceMap.tsx:455`).
    - Fix: put the stand at `roadW/2 + 32`, or move it 20 px further up.

14. **The finish line is 200 px below the last block; the spec asks for ~120.**
    - Where: `src/styles/global.css:190` (`--finish-gap: 200px`).
    - Fix: 120–140 px.

15. **Archive table and cards: names never scramble on keyboard focus.** The spec requires `:focus-visible`.
    - Where: `Archive.tsx:120` and `:149` (no `playKey`).
    - Fix: bump a `playKey` on keyboard focus inside the row, as `Orbitarium.tsx` does.

16. **Scramble width creep:** while scrambling, the inline width grows by 1.5 px in the Orbitarium list and 1 px in the archive, because the per-letter cells drop kerning. The layout does not move.
    - Fix: apply `font-kerning: none` to the resting text as well, so both states are the same width (`DecryptedText.tsx` / `.css`).

17. **Grid cars sit in the centre of the road, while the white slot marks alternate left and right** (`RaceMap.tsx:391-394`).
    - Fix: give each parked car the same ±0.16·roadW offset as its slot, blending to 0 as the race starts.

18. **The road shadow is a plain offset stroke with no blur** (`RaceMap.tsx:127`); the spec asks for a small blur. Add a small `feGaussianBlur` filter, or accept as is.

19. **Not checked:** Lighthouse mobile score (spec target ≥85).

### Screenshots
All files are in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview2/shots/`; open the starred ones first.

- **Loader:** `1440-loader-01.png` … `1440-loader-07.png` (throttled network; ★ 02 at 2/5, ★ 04 at 4/5, 07 fading out)
- **1440 scroll pass:** `1440-01-top.png` … `1440-18-back-top.png`
  - ★ 08 beside the games card (seam)
  - ★ 10 early break-up (confetti)
  - ★ 11 mid break-up (car pile)
  - 12 zero-g, 13 arriving, 15 planets visible, 18 back at top
- **Zooms:** ★ `zoom-08-seam.png`, ★ `zoom-10-chunks.png`, ★ `zoom-768-seam.png`
- **375 (mobile, DPR 2):** `375-01-top.png` … `375-16-orbitarium-bottom.png` (★ 03 and 08 car slivers, 09 grandstand/flag, ★ 11 car pile)
- **1024:** `1024-01-top.png` … `1024-16-orbitarium-bottom.png`
- **Other widths:** `768-x1-top.png`, `768-x2-stage.png`, `768-x3-games.png`, `1100-x2-stage.png`, `1920-x1-top.png`, `1920-x2-stage.png`, `1920-x3-games.png`
- **Reduced motion (1440):** `rm-1440-01-top.png`, `rm-1440-02-intro.png`, `rm-1440-03-finish.png`, `rm-1440-04-orbit.png`
- **Full race-zone overview (stitched):** ★ `rm-1440-overview-a.png`, ★ `rm-1440-overview-b.png`, `rm-1440-overview-full.png`
- **No GPU:** `nogpu-1440-breakup.png`, `nogpu-1440-planets.png`
- **English:** `1440-EN-top.png`

Scripts are in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview2/` (`common.mjs`, `desktop.mjs`, `reduced.mjs`, `checks.mjs`, `budget.mjs`, `extra.mjs`); raw data is in `1440-desktop.json`, `375-desktop.json` and `1024-desktop.json`. No project files were edited.