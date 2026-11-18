# Revisão da v2, rodada 2 (Opus high)

## Review: frontier-models-ui, spec-v2, round 3

Nothing in the project was edited. Scratch files are in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview3/`. The preview server on port 4791 has been stopped and the port is free.

### Result
There are no P0 issues. Most round-1 findings are fixed. Still open:
- **#11 (curve radius): not fixed, and worse at 1440** (91 px before, now about 71).
- **#4 (scenery): only partly fixed.** The cliff and the river still look wrong next to the mockup.
- **New:** thin seam lines across the road in the last stretch.

### Steps 1–2: build, lint, server
- `npm run build` and `npm run lint` are both clean.
- The page was served with `vite preview` on port 4791.

### Step 3: scroll passes
All passes ran and I looked at every screenshot:
- 1440 with motion on (18 shots).
- 375 as a phone (isMobile, DPR 2, 16 shots).
- 1024 (16 shots).
- Reduced motion at 1440, plus a stitched overview of the whole race zone.
- Extra shots at 768, 1100 and 1920 (stage and finish).

### Step 4: previous findings 1–18
| # | Status | Evidence |
|---|---|---|
| 1 | FIXED | The square cut and washed-out band beside "Os 6 jogos" are gone (1440-08, 768). A new hairline problem replaced it: see P2-1. |
| 2 | FIXED | The tail road turns into asphalt and kerb tiles that break off, and the leaf and roof pieces are tinted for dusk (1440-11, zoom-11-breakup). |
| 3 | FIXED | No pile-up. After the road ends the cars stay 58–70 px apart: 1440-11 has the cars at y 4162 → 4431, and 375 and 1024 behave the same. |
| 4 | PARTIAL | Done: groves and woods clumps, a scale-up, a real village (plaza, church, fenced lots), irregular grass patches. Still wrong: the cliff looks like a dirt path and the river is a straight canal (see P1). |
| 5 | FIXED | 375 now has 71 pieces (was 11). Only the hero's text and button rectangles are kept clear. |
| 6 | FIXED | The road enters from y = −60 (zoom-01-grid). |
| 7 | FIXED | About 100–150 px of sea shows below the nav, plus a cove on the left. It sits top-left, not top-right as in the mockup. |
| 8 | FIXED | Plank deck with rails across the road; the kerbs stop at the deck (zoom-bridge). |
| 9 | FIXED | On phones, cars beside a card have opacity 0 (375 shots 03, 04, 06, 08). |
| 10 | FIXED | Below 1250 px the road is 44 px. At 1100 it is fully clear of the stage card and the cars are whole (1100-x2-stage). |
| 11 | NOT FIXED / REGRESSED | Minimum radius: 1440 = 71 (was 91), 1920 = 70, 2560 = 74, 1100 = 78. Tablet widths are lower still: 1024 = 45, 1099 = 46, 768 = 52. On desktop the tight spot is always the last bend into the finish. |
| 12 | FIXED | At 375 the right kerb ends at about x = 373. |
| 13 | FIXED | The grandstand starts 22 px below the finish; there is a visible gap to the flag. |
| 14 | FIXED | `--finish-gap` is 140 px (130 at narrower widths); measured 3759 → 3899 at 1440. |
| 15 | FIXED | Pressing Tab onto an Archive link scrambles the model name (verified frame by frame). |
| 16 | FIXED | Width stays constant while scrambling: 128.8 px in the Orbitarium list, 80.5 px in the archive. |
| 17 | FIXED | Each parked car sits on its own left or right grid slot (zoom-01-grid). |
| 18 | FIXED (accepted) | The road shadow is two wide, faint offset strokes acting as a cheap blur. |
| 19 | Not checked | Lighthouse is not installed. |

### Step 5: scenery against the mockup
- **Density and groves:** good now. The map is full, and the woods zone is dense with pines.
  - It looks like wallpaper: the same lumpy green blob in 2–3 sizes, evenly spaced (Poisson).
  - Missing: big single trees, clearings, fields, hedges along the road.
- **Village:** readable but small (about 680×200 px).
  - It is symmetric and looks like a diagram: two fenced lots of 6 identical flat houses, with a cross-shaped church in a sand plaza.
  - The mockup's village is a large, organic cluster with the fence wrapping around it.
- **Sea:** acceptable. It is a pale band at the top plus a cove at the left edge, with foam, boats, palms and umbrellas.
- **Cliff:** still a 20–26 px wavy tan strip from the screen edge to the road, cut square at the kerbs. It looks like a dirt road crossing the track, not a step (zoom-cliff).
- **River and bridge:** the bridge now reads well. The river is a constant-width (34 px), almost straight band across the whole page behind the games card, so it looks like a canal. The mockup has a wide winding stream.
- **Finish:** the dusk and night colours are good. The light grass patch behind the finish looks like a spotlight with a hard edge on the dark ground (zoom-finish-rm), and few stars are visible.

### Step 6: automated checks
- **Horizontal overflow:** none at 375, 768, 1024, 1440 or 1920. scrollWidth always equals the window width, and scrollX stays 0.
- **Map SVG elements (all under the 650 cap):**
  - 1440: 571 elements, 278 pieces.
  - 1920: 565.
  - 2560: 609.
  - 1100: 476; 1024: 378; 768: 384; 375: 337.
  - The separate break-up SVG has 780 elements (260 chunks).
- **Track:** y always increases. The only step back (−4 px) is where my own check joins the two path slices.
  - The road never enters a block at 1440, 1920, 2560, 1100, 1099, 1024 or 768, and the same holds after switching PT↔EN.
  - No piece sits on the road.
  - Cars are 0–4 px off the centre line.
- **Cars:** 5, which matches the 5 current Orbitarium runs in `archive.json`.
  - Back at the top, the cars return to the exact grid pixels and the planets hide again.
  - Jumping straight down gives the same state as scrolling there step by step.
- **Contrast:**

| Where | Text | Ratio |
|---|---|---|
| Cream cards | navy-2 | 7.05–7.32 |
| Cream cards | `--link-warm` "Jogar" | 4.58 / 4.75 |
| Cream cards | S-number labels | 4.75 |
| Cream cards | navy | 16.6–17.2 |
| Hero, against the map pixels | lede | 5.5 |
| Hero, against the map pixels | stats | 13 |

- **Banned words:** none in `src/` or `dist/`.
- **Console and images:** no console errors, no page errors, no failed requests; 21 images, none broken.
- **Loader:** closes in 1.2–2.4 s locally and 5.7 s on a throttled network (1.5 Mbps). Progress 0→5 is real, the lights all go out together, and the screen fades. All under the 12 s cap.
- **D3 hover:** works on the game h3s, the stage name (after the SplitFlap finishes), the Orbitarium list and the archive.
  - On cream it uses the mixed colours; on the dark sections, the pure model colour.
  - Width and card height do not change, and the real text stays in `.sr-only`.
- **PT/EN:** the switch changes lang, title, description, nav, scene names and "The 6 games", and stores `fm-lang`. The track is rebuilt to the new block rectangles.
- **Reduced motion:** cars parked on the grid, planets visible, Galaxy off (CSS stars instead), and the warning banner shows after scrolling.

### What is still wrong, by priority

**P0:** none.

**P1**
1. **The cliff looks like a dirt road crossing the track** (`src/lib/scenery.ts:326-392`, `RaceMap.tsx:604-606`).
   - Draw it as a step: a 50–80 px `--map-sand-2` face, a darker shadow band at its foot, and rocks along the bottom.
   - Run it on one side of the road only, tapering to zero depth about 40 px before the kerb, so it never meets the road with a square cut.
   - Alternatively, place it where the road does not cross it (beside the stage or games card, in the margin).
2. **The river is a straight canal of constant width** (`scenery.ts:396-404`: `riverWave` amplitude is 14 + 7 px, `riverW` is 34).
   - Make it wind: amplitude 80–140 px with a diagonal drift, width 44–60 px on desktop varying about ±20%.
   - Add bank stones and foam dashes.
   - Have it come out from under the games card at an angle, and keep the bridge at the crossing.

**P2**
1. **Thin seam lines across the asphalt and kerbs at every tail slice boundary.** They are visible before and at the finish at every width, in reduced motion too (zoom-09-slices, zoom-09-curve, 768-x4-finish).
   - Fix: overlap the slices. In `RaceMap.tsx:580-582` use `track.slice(slice.from, slice.to + 3)`.
   - In reduced motion, draw the tail as a single `rm-road-tail` path instead of slices.
2. **The last bend into the finish is tighter than 90 px on every desktop width** (71 at 1440, 70 at 1920, 74 at 2560, 78 at 1100). The shorter finish gap (140 px) made it worse.
   - Fix in `track.ts:182-215`: try starting the bend higher beside the last block (lift values above 1, e.g. 1.5, 2, 3, while the lane has room). Or relax the 140 px gap to about 170 px at widths ≥ 1100.
   - Tablet widths (768–1099) are 45–52 px, against a `targetRadius` of 92. Accept it for tablet, or lower the target there so the code matches what it actually produces.
3. **A single house stands alone beside the stage card** (doc 1354,2671 at 1440; also at 1100) and looks like a glitch.
   - Cause: `'house'` and `'house-sq'` are in the village zone's `small` filler list (`scenery.ts:136`).
   - Fix: remove them from that list, or only allow them within about 150 px of the village.
4. **The finish clearing looks like a spotlight.**
   - Cause: a light `mf-grass-2` patch on the dark tail ground (`RaceMap.tsx:588`).
   - Fix: drop the tail patches, or draw them in a shade between grass-dark and the dusk colour. Make the 20–30 stars in the last 400 px clearly visible, and add a moon as in the mockup.
5. **The village is small and looks like a diagram.** Vary house size and rotation, pack the houses around the plaza irregularly, add trees and gardens inside the lots, and let the village grow into the free margin at ≥ 1440.
6. **The trees look like wallpaper.** Widen the scale range (about 0.7–1.6), add a few large single trees, leave clearings and fields, and line the road with hedges in places.
7. **During the zero-g flight, cars pass over the "Orbitarium-bench" heading and the lede text** (1440-12, 1440-13). Optional: bend their paths around the text column or put them under the text layer.
8. **Lighthouse mobile score (target ≥ 85) is still unmeasured.**

### Screenshots
All in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview3/shots/`. Overview first:
- `rm-1440-overview-a.png`, `rm-1440-overview-b.png`, `rm-1440-overview-full.png` (reduced motion, whole race zone)
- **1440 with motion on:**
  - `1440-01-top.png`, `1440-02-hero-blend.png`, `1440-03-beside-intro.png`, `1440-intro-settled.png`
  - `1440-05-cross-intro-stage.png`, `1440-06-beside-stage.png`, `1440-07-cross-stage-games.png`, `1440-08-beside-games.png`
  - `1440-09-finish.png`, `1440-10-breakup-early.png`, `1440-11-breakup-mid.png`, `1440-12-zero-g.png`, `1440-13-arriving.png`
  - `1440-15-planets-visible.png`, `1440-18-back-top.png`
  - Loader: `1440-loader-01.png` … `1440-loader-07.png`
- **Zooms:** `zoom-09-slices.png`, `zoom-09-curve.png`, `zoom-cliff.png`, `zoom-village.png`, `zoom-bridge.png`, `zoom-finish-rm.png`, `zoom-11-breakup.png`, `zoom-01-grid.png`
- **375:** `375-contact.png` (contact sheet), plus `375-01-top.png` … `375-16-orbitarium-bottom.png`
- **1024:** `1024-contact.png` (contact sheet), plus `1024-01-top.png` … `1024-16-orbitarium-bottom.png`
- **Other widths:** `1100-x2-stage.png`, `1920-x4-finish.png`, `768-x4-finish.png`, `768-x2-stage.png`, `1920-x2-stage.png`
- **Reduced motion and language:** `rm-1440-01-top.png` … `rm-1440-04-orbit.png`, `rm-1440-notice.png`, `1440-EN-top.png`

Raw logs: `out375.txt`, `out1024.txt`, `outchecks.txt`, `outbudget.txt`, plus `1440-desktop.json`, `375-desktop.json` and `1024-desktop.json`, all in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview3/`.