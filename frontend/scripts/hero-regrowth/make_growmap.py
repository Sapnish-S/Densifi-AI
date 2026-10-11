"""Per-pixel hair growth map for the hero regrowth shader.
Usage: python make_growmap.py hair.jpg bald.jpg out_map.png [sim_prefix]

Map is a crop of the head region at half resolution, RGB:
  R = emergence time (0..1, histogram-equalised inside the hair region)
  G = scalp mask (where short stubble shows before the hair grows out)
  B = follicle dots (sparse per-pixel stubble pattern)
Prints the crop rect in UV space for the shader."""
import sys
import numpy as np
from PIL import Image

hair = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32)
bald = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(np.float32)
H, W = hair.shape[:2]

def _box(a, k, axis):
    pad = [(0, 0)] * a.ndim; pad[axis] = (k, k)
    p = np.pad(a, pad, mode="edge")
    c = np.cumsum(p, axis=axis, dtype=np.float64)
    c = np.concatenate([np.zeros_like(np.take(c, [0], axis=axis)), c], axis=axis)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * k + 1, 2 * k + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * k + 1)).astype(np.float32)

def blur(a, rx, ry=None):
    ry = rx if ry is None else ry
    kx, ky = max(0, int(round(rx * 0.58))), max(0, int(round(ry * 0.58)))
    out = a.astype(np.float32)
    for _ in range(3):
        if ky: out = _box(out, ky, 0)
        if kx: out = _box(out, kx, 1)
    return out

# Crop (full-res px) covering everything that differs between the plates
X0, Y0, X1, Y1 = 300, 0, 1300, 960
S = 2  # half resolution
hc = hair[Y0:Y1:S, X0:X1:S]; bc = bald[Y0:Y1:S, X0:X1:S]
h, w = hc.shape[:2]
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
fx = X0 + xx * S; fy = Y0 + yy * S  # full-res coords

diff = np.abs(hc - bc).sum(-1)
region = blur((diff > 18).astype(np.float32), 3) > 0.15
region = blur(region.astype(np.float32), 2) > 0.3

# Skull geometry (must match make_bald.py)
cx, cy, rx, ry, P = 792.0, 600.0, 326.0, 385.0, 2.35
nx = (fx - cx) / rx; ny = (fy - cy) / ry
r = np.where(ny < 0, (np.abs(nx) ** P + np.abs(ny) ** P) ** (1 / P), np.abs(nx))
scalp = (r <= 1.0) & region

rng = np.random.default_rng(11)
# Distance outward from the scalp surface: hair lengthens from the root out
d_out = np.clip((r - 1.0) / 0.32, 0, 1)
# Strand-like noise (elongated mostly vertically, with a sideways sweep on the sides)
n1 = blur(rng.random((h, w)).astype(np.float32), 1.0, 9.0)
n2 = blur(rng.random((h, w)).astype(np.float32), 7.0, 1.5)
side = np.clip(np.abs(nx) * 1.3 - 0.3, 0, 1)
streak = n1 * (1 - side) + n2 * side
streak = (streak - streak.mean()) / (streak.std() + 1e-6)
fine = rng.random((h, w)).astype(np.float32)
# Patterned regrowth: crown fills first, frontal hairline last
crown = np.clip(1 - np.hypot(nx * 0.9, (ny + 0.75) * 1.2), 0, 1)
front = np.clip((fy - 380) / 160, 0, 1) * np.clip(1 - np.abs(nx) * 0.8, 0, 1)
# Hair brightness: bright surface strands land after the darker roots underneath
lum = hc.mean(-1) / 255.0

inside = r <= 1.0
# Forehead skin (both plates are skin there, only tone differs): smooth, noise-free, late
skin_zone = blur(((fy > 395) & (np.abs(fx - cx) < 300) & (lum > 0.38)).astype(np.float32), 6)
noise_w = 1 - skin_zone
score = np.where(
    inside,
    0.30 + 0.20 * streak * 0.5 * noise_w - 0.45 * crown + 0.45 * front + 0.03 * fine * noise_w,
    0.38 + 0.30 * d_out + 0.08 * streak * 0.5,  # outer volume: arrives once the scalp has filled in
)
t = np.zeros((h, w), np.float32)
vals = score[region]
lo, hi = np.percentile(vals, 1), np.percentile(vals, 99)
t[region] = np.clip((vals - lo) / (hi - lo), 0, 1)

scalp_f = blur(scalp.astype(np.float32), 3) * (1 - skin_zone)
dots = (rng.random((h, w)) < 0.22).astype(np.float32) * scalp_f

out = np.stack([t, scalp_f, dots], -1)
Image.fromarray((np.clip(out, 0, 1) * 255).round().astype(np.uint8)).save(sys.argv[3], optimize=True)
print("crop uv:", X0 / W, Y0 / H, X1 / W, Y1 / H, "size", w, h)

# Optional CPU simulation of the shader for tuning
if len(sys.argv) > 4:
    def smooth(e0, e1, x):
        k = np.clip((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k)
    q = np.asarray(Image.open(sys.argv[3])).astype(np.float32) / 255.0
    T, SC, DT = q[..., 0], q[..., 1], q[..., 2]
    frames = []
    for u in (0.0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0):
        ln = 0.3 + 0.7 * smooth(0.2, 1.0, u)
        # warp: outside skull, sample hair from closer to the scalp surface
        sc = np.where(r > 1, (1 + (r - 1) / ln) / np.maximum(r, 1e-6), 1.0)
        sx = cx + nx * sc * rx
        sc = np.where(ny < 0, sc, 1.0)
        sx = cx + nx * sc * rx
        sy = np.where(ny < 0, cy + ny * sc * ry, fy)
        ix = np.clip(sx.round().astype(int), 0, W - 1); iy = np.clip(sy.round().astype(int), 0, H - 1)
        hw = hair[iy, ix]
        hb = blur(hw, 4)
        stub = SC * DT * smooth(0.0, 0.25, u) * (1 - smooth(0.5, 0.9, u))
        shadow = SC * smooth(0.02, 0.4, u)
        base = bc * (1 - 0.45 * stub[..., None]) * (1 - 0.25 * shadow[..., None])
        s_ = u * 1.42 - 0.3
        d = smooth(T - 0.28, T + 0.02, s_)[..., None]   # short-hair density
        k = smooth(T - 0.02, T + 0.16, s_)[..., None]   # full strand detail
        short = hb * 0.9
        c = base * (1 - d) + short * d
        c = c * (1 - k) + hw * k
        frames.append(Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)).resize((w // 2, h // 2)))
    fw, fh = frames[0].size
    sheet = Image.new("RGB", (fw * 4, fh * 2))
    for i, f in enumerate(frames): sheet.paste(f, ((i % 4) * fw, (i // 4) * fh))
    sheet.save(sys.argv[4] + "-sheet.png")
