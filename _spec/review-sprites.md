# Conferência da troca para as peças do Magnific

Independent check of frontier-models-ui after the Magnific sprite swap. I built and linted the working tree, which has uncommitted changes on top of b1b831d. I did not edit the repo. I served dist on port 4793 and stopped it at the end; the "failed" exit notice is from that kill.

## Overall
The sprite swap works. On every hard check except one, it passes:
- **Build and lint:** both clean.
- **Errors:** no console errors, no page errors, no 4xx or failed requests.
- **Sprites load:** all 27 files in `public/map` load and decode in the browser (`img.decode()`).
- **Element budget:** the map SVG has 592 elements at 1440, 589 at 1920 and 589 at 2560 (limit 650). At 1100 it is 498, at 1024 it is 408, at 768 it is 404, at 375 it is 328.
- **Horizontal overflow:** none. scrollWidth equals clientWidth at 375, 390, 414, 600, 768, 1024, 1099, 1100, 1280, 1440 and 1920.
- **Loader:**
  - Cold cache at 1.5 Mbit/s: the loader is gone at 7.1 s. One earlier throttled run took 10.6 s, but about 5 s of that passed before the JS arrived, so I count it as start-up noise.
  - All 27 `/map/` requests finish before the loader starts to leave (last one at 6.1 s, loader gone at 7.1 s). The map step is now the slowest of the five.
  - Unthrottled: 1.2 to 2.3 s.
- **No pop-in:** I compared the scenery between the moment the loader starts to fade and 2.5 s later, at 1440 and 375. Only the hero text animation and the compare bar change.
- **Cars:**
  - They stay on the road: at most 4 px from the centre line on the track at 1440, 1024 and 375. The 5 to 9 px on the grid is the intended stagger.
  - The finish, break-up, zero-g flight and planet arrival all work.
  - Scrolling back to the top restores the grid exactly, and jumping straight down gives the same state as scrolling there.
- **Pieces on the road:** none at any width.
- **Houses and church:** all 31 stand upright. The largest turn is 3°, and none is mirrored.
- **Ground textures:** no visible seams. Pixel differences across the 512 px tile edges are about the same as inside the texture (grass 5.2 vs 4.7, sand 2.3 vs 1.6, sea 3.2 vs 1.6), and on screen I see no lines at x = 512 or 1024.
- **Hero text contrast:** it passes AA over the map at 1440 and 375. At 1024 one sample fails, see P2-6.

Compared with `design/mockup-pista-cartoon.png`, it is much closer than the old flat SVG pieces: textured beach, sea and grass, illustrated groves, a dense dark wood toward the finish, river with bridge, village with church, dusk and moon. The differences that remain:
- Houses read as roof squares seen from above with only a thin wall strip. The mockup has real 3/4 cottages with walls.
- The cliff reads as a sandy dirt road, not a rock face.
- The bridge is a flat plank square. The mockup has an arched bridge with railings.
- The kerbs are thinner than in the mockup.

## P1
1. **Pine sprite carries a piece of the neighbouring tree.** `public/map/pine.webp` has a separate dark-green fragment at its top edge: 289 px, about 50×8 at the sprite's top, average colour rgb(27,42,18). On the map it shows as a short dark dash floating above every pine, about 48 times at 1440 (10 single pines plus the pines inside the woods groups). It is easy to see in the dark wood near the finish (`z-finish.png`, around (185,303), (538,358), (1272,368)) and also in daylight. The pine's real drawing starts at y = 52, so the whole pine is also drawn about 6 px off centre.
   - Fix in `scripts/cut-map-sprites.cjs`: after removing the magenta, keep only the largest connected opaque area (drop pieces under about 2% of its size), trim again, and run the cut again. A quicker option is an `OVERRIDE` box for pine that starts at y ≥ 52.
   - The same cleanup removes the smaller strays in three other sprites. `rocks` has 75 px and 27 px slivers on its left edge, and its drawing starts at x = 54. `pine-2` has a 4 px stray, and its drawing starts at x = 58. `church` has a 13 px stray at the bottom, and its drawing ends at y = 217 of 256.
   - After the cut, copy the new sizes into `SPRITES` in `src/lib/sceneryKit.ts`.

## P2
1. **Purple edges on every sprite.** The magenta background was never removed from the edge pixels. In 65 to 99% of the outer-edge pixels the colour leans purple. Average of the outermost ring: tree-round (91,29,63) at alpha 153, bush (94,22,82), house (70,13,64), bridge (66,14,58). The second ring is still purplish (64,27,34) where dark green is expected. On screen this gives a plum-brown outline. Fully magenta pixels exist only at alpha below 32, so there is no bright pink fringe.
   - Fix in the cut script: for every pixel with alpha below 255, remove the magenta from the colour. For example, compute `c = (c − (1−a)·#ff00ff)/a`, clamped. Another option is to give those pixels the colour of the nearest fully opaque pixel and shrink the alpha by 1 px.
2. **Hairline across the map at the end of the ground.** At 1440 there is a 1 px dark line across the full width at y ≈ 4025.9. It is where the solid grass rect (height 736.698) meets the masked fade rect, and both edges fall on fractions of a pixel. See `cu-stand.png`, around y = 820. The same kind of joint exists at breakY = 3289.19.
   - Fix in `RaceMap.tsx`: round `breakY` and `fadeY` to whole pixels, and make each of the joined rects 1 px taller so they overlap.
3. **Shadows that read as grey discs.**
   - Palms use the `crown` ground type, so the shadow is a solid ellipse almost as wide as the palm. Under see-through palm fronds, especially on sand, it shows as a grey disc (`z-hero.png`, `cu-trees.png`). Fix: add a `palm` ground type with rx ≈ 0.25·w and ry ≈ 0.22·h, and use it for palm and palm2.
   - The church's shadow is placed from the full sprite height, but the drawing ends 39 px above the bottom of the sprite. The shadow lands under the plaza as a round dark patch (`cu-village.png`). Removing the stray in P1 fixes it.
4. **Fence over a house.** The lower fence run in the village crosses the front wall of a house-l (`cu-village.png`, bottom middle). Two runs of fence also overlap, which doubles their posts. Fix in `scenery.ts`: check the fence placement against the house footprints, or let the houses claim the space before the fences.
5. **Sprites partly under cards.** At 1440 the rocks along the foot of the cliff are 21 to 27% under the top edge of the intro card (`z-cliff.png`, bottom). At 1024, groves and woods are 16 to 27% under the intro and games cards. Fix: add a margin of about 12 px around the card rectangles when checking where pieces may go, and give the cliff rocks an extra 8 px.
6. **Hero at 1024 is crowded.** Palms, two umbrellas and a bush sit within 6 px of the hero title, the stats and the buttons (`z-1024-hero.png`). The "benchmarks" label sampled 4.33:1 at one point over a darker patch of sand (AA needs 4.5:1). Fix: keep pieces at least 16 px away from the boxes of the hero h1, p, dl and buttons, or make the `rm-calm` ellipse larger at 1024 to 1279 px.
7. **Look and feel against the mockup.**
   - The cliff (`mf-sand-2` band) reads as a dirt track. Give it a rock-coloured face with a darker foot, or draw it as a rock-face sprite.
   - Hedges along the road look like a chain of separate green capsules. Draw one long hedge per run, or overlap the pieces more.
   - Houses are mostly roof squares; regenerating them in Magnific as 3/4 cottages with walls showing would match the mockup better.
8. **Smaller things.**
   - With reduced motion, the road ends in a hard square edge while the grass under it fades (`z-finish.png`, y ≈ 685). Fade or round off the end of the road.
   - The moon glow shows as a flat grey circle.
   - At 1440 one house-l is cut by the right edge of the screen.

## Files
All under `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview5/shots/`.

**Overview (reduced motion, 1440):**
- `rm-1440-overview-full.png` (1440×4529)
- `rm-1440-overview-a.png`
- `rm-1440-overview-b.png`

**Crops of the overview:**
- `z-hero.png`
- `z-cliff.png`
- `z-village.png`
- `z-river.png`
- `z-finish.png`

**Close-ups:**
- `cu-sheet.png`
- `cu-village.png`
- `cu-stand.png`
- `cu-bridge.png`
- `cu-hedge.png`
- `cu-trees.png`

**Sprite checks:**
- `sprites-on-dark.png`
- `stray-pine.png`

**Contact sheets:**
- `sheet-1440-a.png` (top, village, stage, bridge)
- `sheet-1440-b.png` (finish, break-up early and mid, zero-g)
- `sheet-375.png`
- `sheet-1024.png`

**Individual frames and other:**
- `1440-01-…` through `1440-18-…png`, `375-*.png`, `1024-*.png`
- `z-1024-hero.png`
- `popin-375-ab.png`, `popin-1440-ab.png`

Scripts and logs are in `C:/Users/jouberth.macedo/AppData/Local/Temp/fmreview5/`:
- **Scripts:** `sprites.cjs`, `strays.cjs`, `loader.mjs`, `popin.mjs`, `undercard.mjs`, `contrast2.mjs`, `closeup.mjs`, `seam.mjs`
- **Logs:** `out1440.txt`, `out375.txt`, `out1024.txt`