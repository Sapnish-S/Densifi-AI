"""Build a bald 'plate' of hero.jpg (1600x2400) by synthesising a skull dome from the
real forehead skin. Usage: python make_bald.py <in.jpg> <out.jpg> [preview.png]"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src = Image.open(sys.argv[1]).convert("RGB")
W, H = src.size
img = np.asarray(src).astype(np.float32)

def _box(a, k, axis):
    pad = [(0, 0)] * a.ndim
    pad[axis] = (k, k)
    p = np.pad(a, pad, mode="edge")
    c = np.cumsum(p, axis=axis, dtype=np.float64)
    c = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * k + 1, 2 * k + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * k + 1)).astype(np.float32)

def blur(a, r):
    """Approximate Gaussian blur (3 box passes) on 2D or HxWxC float arrays."""
    k = max(1, int(round(r * 0.58)))
    out = a.astype(np.float32)
    for _ in range(3):
        out = _box(_box(out, k, 0), k, 1)
    return out

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# Skull ellipse (image px)
cx, cy, rx, ry = 792.0, 600.0, 326.0, 385.0
P = 2.35  # superellipse exponent above the brow: rounder crown than an ellipse

# --- Forehead sample band -> smooth base colour per column + high-frequency detail
fx0, fx1, fy0, fy1 = 600, 975, 500, 588
band = img[fy0:fy1, fx0:fx1]
band_low = blur(band, 18)
detail = np.clip(band / np.maximum(band_low, 1), 0.75, 1.3)  # multiplicative texture
col_base = blur(band.mean(axis=0, keepdims=True).repeat(40, 0), 25)[20]  # (cols, 3)

# Horizontal mapping: position across the skull at that row -> forehead column
dy = np.clip((yy - cy) / ry, -1, 1)
half = rx * np.sqrt(np.clip(1 - np.minimum(dy, 0) ** 2, 1e-4, 1))
u = np.clip((xx - (cx - half)) / (2 * half), 0, 1)
# forehead spans only the inner part of the skull width at brow level
u_f = np.clip((u - 0.13) / 0.74, 0, 1)
fcol = (u_f * (fx1 - fx0 - 1)).astype(int)
base = col_base[fcol]

# Texture: mirror-tile the detail band vertically / horizontally at native scale
bh, bw = detail.shape[:2]
def pingpong(v, n):
    v = np.mod(v, 2 * n)
    return np.where(v < n, v, 2 * n - 1 - v).astype(int)
ty = pingpong(fy1 - yy, bh)
tx = pingpong(xx - fx0, bw)
tex = detail[bh - 1 - ty, tx]
tex = 1 + (tex - 1) * 0.6

# 3D shading: superellipsoid crown above the brow, straight cylinder-like sides below.
L = np.array([-0.5, -0.42, 0.76]); L = L / np.linalg.norm(L)
Hv = L + np.array([0, 0, 1.0]); Hv = Hv / np.linalg.norm(Hv)

def normals(x, y):
    nx = (x - cx) / rx
    ny = (y - cy) / ry
    above = ny < 0
    r_s = np.where(above, (np.abs(nx) ** P + np.abs(ny) ** P) ** (1 / P), np.abs(nx))
    nz = np.sqrt(np.clip(1 - np.clip(r_s, 0, 1) ** 2, 0, 1))
    gx = np.sign(nx) * np.abs(nx) ** (P - 1)
    gy = np.where(above, np.sign(ny) * np.abs(ny) ** (P - 1), 0.0)
    g = np.sqrt(gx ** 2 + gy ** 2) + 1e-6
    k = np.sqrt(np.clip(1 - nz ** 2, 0, 1))
    return gx / g * k, gy / g * k, nz

def light(x, y):
    a, b, c = normals(x, y)
    d = np.clip(a * L[0] + b * L[1] + c * L[2], 0, 1)
    return 0.10 + 0.9 * d

def spec(x, y):
    a, b, c = normals(x, y)
    return np.clip(a * Hv[0] + b * Hv[1] + c * Hv[2], 0, 1) ** 28

# albedo = forehead colour / lighting at the forehead point it was sampled from
x_src = fx0 + u_f * (fx1 - fx0)
albedo = base / light(x_src, np.full_like(yy, 545.0))[..., None]
skin = albedo * light(xx, yy)[..., None] * tex
skin += spec(xx, yy)[..., None] * np.array([48, 38, 30], np.float32)
# Sides above the ears fall into shadow toward the sideburns
side = np.clip((yy - 590) / 145, 0, 1) * np.clip((np.abs(xx - cx) / rx - 0.72) / 0.28, 0, 1)
skin *= (1 - 0.8 * side)[..., None]

# Warm back-light rim along the top/left of the dome
nx = (xx - cx) / rx; ny = (yy - cy) / ry
r_ell = np.sqrt(nx ** 2 + ny ** 2)
r_sup = (np.abs(nx) ** P + np.abs(ny) ** P) ** (1 / P)
r = np.where(ny < 0, r_sup, np.abs(nx))  # below the brow the head runs straight down to the ears
rim = np.clip((r - 0.86) / 0.14, 0, 1) * np.clip(1 - r, 0, 1) * 3.5
rim *= np.clip(-ny, 0, 1) * (0.6 + 0.4 * np.clip(-nx + 0.3, 0, 1))
skin += rim[..., None] * np.array([120, 70, 35], np.float32)

# --- Masks
inside = (r <= 1.0).astype(np.float32)
inside = blur(inside, 2.5)

# Replacement region: everything above a hairline curve y_b(x), near the head
def y_b(x):
    x = np.asarray(x, np.float32)
    mid = 505.0
    left = np.interp(x, [380, 470, 525, 610], [735, 735, 620, mid])
    right = np.interp(x, [975, 1050, 1110, 1230], [mid, 590, 735, 735])
    return np.where(x < 610, left, np.where(x > 975, right, mid))
region = (yy < y_b(xx)).astype(np.float32)
region *= ((xx > 330) & (xx < 1280)).astype(np.float32)
region = blur(region, 26)

bg = np.full_like(img, 4.0) + np.random.default_rng(7).normal(0, 1.4, img.shape).astype(np.float32)
fill = skin * inside[..., None] + bg * (1 - inside[..., None])
out = img * (1 - region[..., None]) + fill * region[..., None]
out = np.clip(out, 0, 255).astype(np.uint8)

Image.fromarray(out).save(sys.argv[2], quality=88)
if len(sys.argv) > 3:
    Image.fromarray(out).crop((250, 0, 1350, 1150)).resize((770, 805)).save(sys.argv[3])
