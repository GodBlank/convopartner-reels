#!/usr/bin/env python3
"""rig.py — cut a character's moving hand/arm into its own layer so Remotion can animate it.

    python3 tools/rig.py

For each entry in CUTS: the polygon (source pixels) is copied to public/story/rig/<name>-arm.png and filled in on
public/story/rig/<name>-base.png (normalised-convolution inpaint, alpha included, so the art behind the hand is
guessed from its surroundings). Also prints the lid skin colours sampled above/below each eye for RIGS in puppet.tsx.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHARS = os.path.join(ROOT, "public", "story", "chars")
OUT = os.path.join(ROOT, "public", "story", "rig")

CUTS = {
    "dimas": [(500, 868), (730, 868), (742, 960), (742, 1072), (500, 1076)],  # palm-up hand, pivots at the cuff
    "rina-senang": [(288, 308), (406, 308), (412, 470), (398, 664), (302, 664), (288, 470)],  # raised fist + forearm
    "rina": [(380, 664), (606, 664), (606, 792), (380, 792)],  # clasped hands
    "rina-sedih": [(424, 662), (598, 662), (598, 762), (424, 762)],  # lower hand
}
EYES = {
    "dimas": [(452, 278, 55, 34), (570, 272, 66, 30)],
    "rina": [(474, 225, 48, 34), (572, 218, 55, 30)],
    "rina-senang": [(472, 227, 50, 38), (571, 218, 57, 32)],
    "rina-sedih": [(474, 225, 48, 34), (571, 218, 54, 30)],
}


def inpaint(rgba, hole):
    """Fill hole pixels from their surroundings: blur(known*img)/blur(known) at growing radii."""
    img = rgba.astype(np.float64)
    a = img[..., 3:4] / 255
    pre = np.concatenate([img[..., :3] * a, img[..., 3:4]], axis=2)  # premultiplied, so transparent stays clean
    filled = hole.copy()
    known = (~hole).astype(np.float64)
    out = pre.copy()
    for r in (3, 6, 12, 24, 48, 96):
        k = Image.fromarray((known * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
        kn = np.asarray(k, np.float64)[..., None] / 255
        acc = np.zeros_like(pre)
        for c in range(4):
            ch = Image.fromarray(np.clip(pre[..., c] * known, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
            acc[..., c] = np.asarray(ch, np.float64)
        est = acc / np.maximum(kn, 1e-4)
        fill = hole & (kn[..., 0] > 0.02)
        out[fill] = est[fill]
        pre = np.where(fill[..., None], est, pre)
        known = np.where(fill, 1.0, known)
        hole = hole & ~fill
        if not hole.any():
            break
    al = np.clip(out[..., 3:4], 0, 255)
    rgb = np.where(al > 0, out[..., :3] / np.maximum(al / 255, 1e-4), 0)
    # filled pixels are either body or empty background, never half-transparent smears
    al = np.where(filled[..., None], np.where(al > 150, 255.0, 0.0), al)
    return np.clip(np.concatenate([rgb, al], axis=2), 0, 255).astype(np.uint8)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, poly in CUTS.items():
        im = Image.open(os.path.join(CHARS, f"{name}.png")).convert("RGBA")
        m = Image.new("L", im.size, 0)
        ImageDraw.Draw(m).polygon(poly, fill=255)
        mask = np.asarray(m) > 0
        src = np.asarray(im)
        arm = src.copy()
        arm[~mask] = 0
        # feather the arm layer's cut edge by 2px so the seam does not show
        soft = np.asarray(m.filter(ImageFilter.GaussianBlur(1.5)), np.float64) / 255
        arm[..., 3] = (arm[..., 3] * soft).astype(np.uint8)
        Image.fromarray(arm).save(os.path.join(OUT, f"{name}-arm.png"))
        grow = np.asarray(m.filter(ImageFilter.MaxFilter(5))) > 0
        Image.fromarray(inpaint(src, grow)).save(os.path.join(OUT, f"{name}-base.png"))
        rgb = src[..., :3]
        skins = []
        for x, y, w, h in EYES[name]:
            top = rgb[y - h // 2 - 6, x - 4 : x + 5].mean(0)
            bot = rgb[y + h // 2 + 4, x - 4 : x + 5].mean(0)
            skins.append(["#%02X%02X%02X" % tuple(int(v) for v in top), "#%02X%02X%02X" % tuple(int(v) for v in bot)])
        print(name, "skins", skins)


if __name__ == "__main__":
    main()
