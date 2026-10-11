# Hero regrowth assets

Offline generators for the landing-page hair regrowth effect
(`components/hair-regrowth-canvas.tsx`). Requires Python 3 with `numpy` and `Pillow`.

From `frontend/` (assets live in the gitignored `site-assets/` folder, then go to Object Storage):

```sh
python scripts/hero-regrowth/make_bald.py    site-assets/hero/hero-man.jpg site-assets/hero/hero-man-bald.jpg
python scripts/hero-regrowth/make_growmap.py site-assets/hero/hero-man.jpg site-assets/hero/hero-man-bald.jpg site-assets/hero/hero-growmap.png
npm run assets:upload
```

- `hero-man-bald.jpg` — same 1600×2400 framing with a synthesised bald scalp.
- `hero-growmap.png` — head-region crop (UV 0.1875,0 → 0.8125,0.4) at half resolution:
  R = per-pixel emergence time, G = scalp area, B = follicle dots.

The skull geometry (`cx, cy, rx, ry, P`) is shared by both scripts and the shader
(`SKULL` in the component); change all three together. A real bald edit of the photo
can replace `hero-man-bald.jpg`, but regenerate the growth map afterwards.
