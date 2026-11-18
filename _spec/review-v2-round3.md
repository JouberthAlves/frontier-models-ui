# Revisão da v2, rodada 3 (Opus high)

## Round-3 recheck of frontier-models-ui (open items from review-v2-round2)

Nothing in the project was edited. Only `dist/` was rebuilt by `npm run build`. Scratch files are in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview4/`. The preview server on port 4792 has been killed and the port is free.

**Overall:** there is no P0. P1-2 (river) and five of the seven P2 items are fixed. Still open:
- **P1-1 (cliff):** the structure is fixed, but it still reads as a dirt road.
- **P2-1 (seams):** fixed in reduced motion only. The seams are still visible with motion on.
- **P2-8 (Lighthouse):** not measured.

`npm run build` and `npm run lint` are both clean.

### Status of each round-2 item

| Item | Status | Evidence |
|---|---|---|
| **P1-1 Cliff** | PARTIAL (structure fixed, look not fixed) | It now runs on one side only. It tapers to a point about 130 px before the road and never touches the kerb. It has a 62 px face, a darker foot band and rocks along the bottom (`zoom-cliff.png`). But the dash pattern on `.rm-cliff-strata` (`RaceMap.css:200-208`, `stroke-dasharray: 34 16 12 20`) runs along the middle of the tan band. Combined with the light lip, it reads as a dirt road with a centre line. It also runs off the right edge of the screen above the intro card. The mockup's cliff is a vertical rock face below the village. |
| **P1-2 River** | FIXED (one cosmetic issue) | It now winds. Width is 46–60 px and varies about ±20%. It has sand banks and stones, comes out from under the games card at an angle, and the bridge sits at the crossing (`zoom-river.png`). Remaining issue: `.rm-river-flow` (`RaceMap.css:236`, `dasharray 15 31`) is two evenly dashed lines along the middle. Together with the sand banks, it looks a bit like a blue road with lane markings. |
| **P2-1 Seams** | PARTIAL | Reduced motion is fixed: the tail is one `rm-road-tail` path and no seams show (`zoom-finish-rm.png`). With motion on, light hairlines still cross the asphalt and kerbs at every slice boundary. This shows at 1440 (`zoom-09-slices.png`: about 4 lines between the bend and the finish), at 1024 (`1024-09-finish.png`) and at 375 (`375-09-finish.png`, near y 410). `SEAM_OVERLAP = 8` does not help. The cause is that each slice `<g>` draws kerb-red, kerb-white and then asphalt, all with butt caps at the same start point. The anti-aliased edge of the next slice's kerb strokes therefore shows through its own asphalt edge. |
| **P2-2 Last bend** | FIXED on desktop | Minimum radius is 92 at 1440 (`tightCount` 0), 92 at 1100, 88 at 1920 and 78 at 2560. On those wider screens the tight spot is no longer the finish bend. It is the right-hand bend between the stage and games cards: (1548, 2992) R 88 at 1920 and (2032, 3007) R 78 at 2560. `--finish-gap` is now 170 px at ≥ 1100. Tablet and phone are still 46–51 (1024, 1099, 768, 375). The `track.ts:293-296` comment says tablets get about 45, but the code still sets `targetRadius = 92` whenever `roadW >= 44`, and that includes 1024. So the code and the comment still disagree. |
| **P2-3 Stray house** | FIXED | All 34 houses at 1440 sit in y 1644–2070, which is the village zone. The stage card starts at 2121. Nothing is near the old spot (1354, 2671). |
| **P2-4 Finish spotlight** | FIXED | No light patch on the tail ground. There is a moon with a halo and about 20–30 clearly visible stars (66 elements in the tail scenery group). See `1440-09-finish.png` and `zoom-finish-rm.png`. |
| **P2-5 Village** | PARTIAL | Improved: houses vary in size and rotation, there are gardens, a plaza with a church, and some houses outside the fence. Still diagram-like (`zoom-village.png`): the fence is a perfect dashed ellipse, the streets are near-straight sand lines, and every house is a flat square with a diagonal line. About 13 houses outside the fence are scattered over roughly 1300×450 px, including next to the road at (209, 1880) and (336, 2070), so it looks like confetti. The mockup has a dense cluster with larger, readable roofs. |
| **P2-6 Tree wallpaper** | FIXED | Scale range is now 0.70–1.52. There are 19 large single oaks (`oak` and `oak-d`), hedge rows along the road, and lighter clearings. There is only one field (`field2`), and at 1440 it looks like a wooden pallet (about x 90, y 1860). |
| **P2-7 Cars over the Orbitarium text** | FIXED | During zero-g the cars follow the left margin (x 35–270) and stay clear of the heading and lede (`1440-12-zero-g.png`, `1440-13-arriving.png`). New minor issue: two cars overlap during the flight. At 1440 they are at (112, 4739) and (111, 4740), the green and lilac cars (`zoom-12-zero-g.png`). Two other cars are also pinned to x = 50. |
| **P2-8 Lighthouse** | NOT FIXED | Still unmeasured: Lighthouse is not installed anywhere (project, fmreview, or global). |

### Automated checks (all pass)

- **Overflow:** none at 375, 768, 1024, 1440 or 1920. scrollWidth equals the window width every time, scrollX stays 0, and nothing sticks out.
- **Map SVG elements (all under the 650 cap):**

| Width | Elements | Pieces |
|---|---|---|
| 1440 | 601 | 291 |
| 1920 | 617 | 310 (= `MAX_PIECES`) |
| 2560 | 617 | |
| 1100 | 494 | |
| 1024 | 394 | |
| 768 | 410 | |
| 375 | 345 | |

  The separate break-up SVG has 780 elements (260 chunks).
- **Track:** y always increases. The only step back (−12 px) is where my check joins `rm-road-body` and `rm-road-tail`, because the body now carries 8 px of `SEAM_OVERLAP`.
  - The road enters no block at 1440, 1920, 2560, 1100, 1099, 1024 or 768, and the same holds after switching EN→PT.
  - No piece sits on the road.
  - Cars stay 0–9 px off the centre line.
  - At 375 the road runs behind the cards on purpose, and the cars there have opacity 0.
- **Cars:** 5 cars and 5 planets. That equals the 5 current Orbitarium runs: GPT-6 Astra, GPT-6.1 Sol, Grok 4.7, Fable 5.1 and Gemini 4 Argon.
  - Back at the top, the cars return to the exact grid pixels and the planets hide again.
  - Jumping straight down gives the same planet state as scrolling there step by step (at 1440, 375 and 1024).
- **Contrast:**

| Where | Text | Ratio |
|---|---|---|
| Cream cards | navy-2 | 7.05–7.32 |
| Cream cards | `--link-warm` "Jogar" | 4.58 / 4.75 |
| Cream cards | S-number labels | 4.75 |
| Cream cards | navy | 16.56–17.18 |
| Hero, against the map pixels | lede | 5.52 |
| Hero, against the map pixels | stats | 12.94 |

- **Banned words** (whole-word, spec §1 list): 0 hits in `src/`, `dist/` and `index.html`.
- **Console and images:** no console errors, page errors or failed requests at 1440, 375, 1024 or in reduced motion. 21 images, none broken.
- **Loader** (all under the 12 s cap):

| Run | Loader gone after |
|---|---|
| 1440 | 2.8 s |
| Reduced motion | 1.3 s |
| 375 | 2.0 s |
| 1024 | 2.3 s |
| Throttled 1.5 Mbps | 5.1 s |

  On the throttled run the steps fill one by one (0→2→3→4→5), then the lights go dark and the screen fades.
- **Prompt version on each game card:**

| Game | Card shows |
|---|---|
| GPT-6.1 Sol | V3.4 |
| GPT-6 Astra | V3.4 |
| Opus 5.5 | V3.4 |
| Gemini 4 Argon | V3.4 |
| Fable 5.2 | **V3.4.1** |
| Gemini 4 Hydrogen | V3.4 |

  Each matches `archive.json`.
- **Also still working:** the D3 hover (fixed width and card height, `.sr-only` intact), PT↔EN switching, and the reduced-motion banner after scrolling.

### Remaining problems by priority

**P0:** none.

**P1**
1. **The cliff still reads as a dirt road** (`scenery.ts:340-434`, `RaceMap.css:194-208`, `RaceMap.tsx:~655-660`).
   - Remove the dashed strata line. If you keep it, draw 2–3 short slanted crack strokes at irregular spacing, never one line along the band.
   - Make the face read as rock: a darker `--map-sand-2`/trunk mix with vertical streaks, plus a hard dark shadow band of 8–12 px below the foot.
   - Put grass right up to the lip on the high side so the step shows. The light lip stroke currently makes it look like a road edge.
   - Better still, follow the mockup: place the cliff right under the village (its fence on the top edge) and stop it at the card instead of running off-screen.

**P2**
1. **Seams with motion on** (`RaceMap.tsx:681-699`, `Road` at 196-205). Draw each slice in two passes:
   - Pass 1: the kerb-red and kerb-white of every slice.
   - Pass 2: the asphalt and centre line of every slice.
   - Apply the same per-slice opacity to both nodes (put `data-slice={i}` on both and set `opacity` on each).
   - Cheaper alternative: start each slice's asphalt and centre line about 6 px before its kerbs (a second path def `rm-slice-i-a` from `slice.from - 6`). The asphalt-on-asphalt edge is invisible, and it hides the kerb start edge.
2. **River foam looks like lane markings** (`scenery.ts:531-577`, `RaceMap.css:236-244`). Replace the two continuous dashed polylines with short, separate, curved foam strokes of 6–14 px. Place them at random offsets near the banks and around stones and the bridge piers, with random lengths and gaps.
3. **The village is still a diagram and its outer houses are scattered** (`scenery.ts` village builder, about 736-840).
   - Fence: replace the perfect dashed ellipse with a wobbly polyline that follows the lots.
   - Streets: curve them.
   - Houses outside the fence: limit them to 3–5, all within about 120 px of the fence. None near the road (the ones at (209, 1880) and (336, 2070) at 1440).
   - Scale the houses up by 1.2–1.4.
   - Give the church a bell tower or distinct roof so it does not read as a red cross.
4. **Tablet curve radius and the code disagree** (`track.ts:293-296`). The target is 92 but tablets produce 46–51, at 768, 1024 and 1099. Set `targetRadius = width < 1100 ? 48 : 92`, or accept it in the spec. Optionally lift the stage→games bend at ≥ 1920 (88 at 1920, 78 at 2560).
5. **Two cars overlap during zero-g** (`RaceMap.tsx` flight paths, about 440-500). At 1440, cars 3 and 4 sit on the same pixel around scroll 4262, and two more are pinned at x = 50. Spread the start offsets and Bézier control points by car index, or clamp to a minimum spacing of 40 px.
6. **The single field looks like a pallet.** Draw it larger (about 120×70) with 5–7 crop rows and a darker outline. Or remove it.
7. **Lighthouse mobile score (target ≥ 85) is still unmeasured.** Run it on the deployed preview.

### Screenshots

The automated checks print only to logs, so there are no screenshots for those.

**Folder:** all shots below are in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview4/shots/`.

**Overview** (reduced motion, 1440, whole race zone): `rm-1440-overview-full.png`, `rm-1440-overview-a.png`, `rm-1440-overview-b.png`

**Zooms:**
- `zoom-09-slices.png` (seams with motion on)
- `zoom-finish-rm.png`
- `zoom-cliff.png`
- `zoom-river.png`
- `zoom-village.png`
- `zoom-12-zero-g.png`

**1440 with motion on:** `1440-contact.png`, plus:
- `1440-09-finish.png`
- `1440-10-breakup-early.png`
- `1440-11-breakup-mid.png`
- `1440-12-zero-g.png`
- `1440-13-arriving.png`
- `1440-15-planets-visible.png`
- Loader: `1440-loader-01.png` … `1440-loader-06.png`

**375:** `375-contact.png`, `375-09-finish.png`, and `375-01` … `375-18`

**1024:** `1024-contact.png`, `1024-09-finish.png`, and `1024-01` … `1024-18`

**Other:** `1920-x4-finish.png`, `rm-1440-01-top.png` … `rm-1440-04-orbit.png`, `1440-EN-top.png`

**Raw logs** in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview4/`:
- `out1440.txt`, `out375.txt`, `out1024.txt`, `outrm.txt`
- `outchecks.txt`, `outbudget.txt`
- `1440-desktop.json`, `375-desktop.json`, `1024-desktop.json`