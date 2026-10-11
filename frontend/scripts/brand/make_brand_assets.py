"""Build transparent brand assets from the master logo render (site-assets/source/1.png:
black logo on a horizontal grey→white gradient, 2000×2000).

Usage (from frontend/):
  python scripts/brand/make_brand_assets.py site-assets/source/1.png site-assets
  npm run assets:upload        # then publish to Object Storage (README → "Site assets")

Outputs (under the given folder):
  brand/logo-black.png, brand/logo-white.png  — full lockup (mark + wordmark), trimmed
  brand/mark-black.png, brand/mark-white.png  — follicle mark only, square
  icons/icon-light-32x32.png (dark mark, for light browser UI), icons/icon-dark-32x32.png,
  icons/icon-192.png, icons/icon-512.png, icons/apple-icon.png (180, dark mark on white)
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])
(out / "brand").mkdir(parents=True, exist_ok=True)
(out / "icons").mkdir(parents=True, exist_ok=True)

L = np.asarray(Image.open(src).convert("L")).astype(np.float32)
# The backdrop varies only horizontally: take it from logo-free top rows.
bg = np.median(L[:150], axis=0)[None, :]
ink = 18.0
alpha = np.clip((bg - L) / (bg - ink), 0, 1)
alpha[alpha < 0.04] = 0

ys, xs = np.where(alpha > 0.04)
pad = 8
x0, x1, y0, y1 = xs.min() - pad, xs.max() + pad + 1, ys.min() - pad, ys.max() + pad + 1
a = alpha[y0:y1, x0:x1]

def rgba(a, rgb):
    h, w = a.shape
    px = np.zeros((h, w, 4), np.uint8)
    px[..., :3] = rgb
    px[..., 3] = np.round(a * 255).astype(np.uint8)
    return Image.fromarray(px, "RGBA")

def save_scaled(img, path, height):
    w = round(img.width * height / img.height)
    img.resize((w, height), Image.LANCZOS).save(path, optimize=True)

# Full lockup at 320px tall (crisp at 80px CSS @4x)
save_scaled(rgba(a, (12, 10, 9)), out / "brand/logo-black.png", 320)
save_scaled(rgba(a, (255, 255, 255)), out / "brand/logo-white.png", 320)

# Mark only: the follicle symbol sits left of the wordmark. Find the widest
# empty column gap in the left half to split them.
cols = (a > 0.1).sum(axis=0)
half = a.shape[1] // 2
gap_start, best, run_s = None, (0, 0), None
for x in range(half):
    if cols[x] == 0:
        run_s = x if run_s is None else run_s
        if x - run_s > best[1] - best[0]:
            best = (run_s, x)
    else:
        run_s = None
split = (best[0] + best[1]) // 2 if best[1] > best[0] else int(a.shape[1] * 0.3)
m = a[:, :split]
mys, mxs = np.where(m > 0.04)
m = m[mys.min():mys.max() + 1, mxs.min():mxs.max() + 1]
side = int(max(m.shape) * 1.08)
sq = np.zeros((side, side), np.float32)
oy, ox = (side - m.shape[0]) // 2, (side - m.shape[1]) // 2
sq[oy:oy + m.shape[0], ox:ox + m.shape[1]] = m

mark_black = rgba(sq, (12, 10, 9))
mark_white = rgba(sq, (255, 255, 255))
mark_black.resize((512, 512), Image.LANCZOS).save(out / "brand/mark-black.png", optimize=True)
mark_white.resize((512, 512), Image.LANCZOS).save(out / "brand/mark-white.png", optimize=True)

mark_black.resize((32, 32), Image.LANCZOS).save(out / "icons/icon-light-32x32.png", optimize=True)
mark_white.resize((32, 32), Image.LANCZOS).save(out / "icons/icon-dark-32x32.png", optimize=True)

def on_bg(mark, size, bg_rgb, inset=0.16):
    canvas = Image.new("RGBA", (size, size), bg_rgb + (255,))
    inner = round(size * (1 - 2 * inset))
    m2 = mark.resize((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(m2, ((size - inner) // 2, (size - inner) // 2))
    return canvas.convert("RGB")

on_bg(mark_black, 180, (255, 255, 255)).save(out / "icons/apple-icon.png", optimize=True)
on_bg(mark_white, 192, (12, 10, 9), 0.14).save(out / "icons/icon-192.png", optimize=True)
on_bg(mark_white, 512, (12, 10, 9), 0.14).save(out / "icons/icon-512.png", optimize=True)
print("lockup", a.shape, "split col", split, "mark", m.shape)
