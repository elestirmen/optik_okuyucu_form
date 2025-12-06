"""
OMR benchmark görüntü üretici + sonuç şablonu hazırlayıcı (tek dosya)

Kullanım (varsayılan girdi: benchmarks/input/filled-base.png):
  python3 benchmarks/generate_variations.py
  python3 benchmarks/generate_variations.py --out benchmarks/output --per 2 --results benchmarks/results.csv

Not: OpenCV ve numpy gerektirir. Varsayılan olarak üretilen metadata'dan
`results.csv` şablonunu da oluşturur; istemezsen `--no-template` ekle.
"""
import argparse
import math
import random
from pathlib import Path

import cv2
import numpy as np


def read_image(path: Path) -> np.ndarray:
    img = cv2.imread(str(path))
    if img is None:
        raise SystemExit(f"Girdi okunamadı: {path}")
    return img


def write_image(path: Path, img: np.ndarray):
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), img)


def clamp01(arr: np.ndarray) -> np.ndarray:
    return np.clip(arr, 0, 1)


def adjust_ev(img: np.ndarray, ev: float) -> np.ndarray:
    factor = 2.0 ** ev
    out = clamp01(img.astype(np.float32) / 255.0 * factor)
    return (out * 255).astype(np.uint8)


def gamma(img: np.ndarray, gamma_value: float) -> np.ndarray:
    inv = 1.0 / max(gamma_value, 1e-3)
    table = ((np.arange(256) / 255.0) ** inv * 255).astype(np.uint8)
    return cv2.LUT(img, table)


def gaussian_blur(img: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0:
        return img
    ksize = max(3, int(sigma * 4) | 1)
    return cv2.GaussianBlur(img, (ksize, ksize), sigma)


def motion_blur(img: np.ndarray, length: int, angle_deg: float) -> np.ndarray:
    if length <= 1:
        return img
    kernel = np.zeros((length, length), dtype=np.float32)
    cv2.line(
        kernel,
        (0, length // 2),
        (length - 1, length // 2),
        1.0,
        thickness=1,
    )
    rot = cv2.getRotationMatrix2D((length / 2 - 0.5, length / 2 - 0.5), angle_deg, 1.0)
    kernel = cv2.warpAffine(kernel, rot, (length, length))
    kernel /= kernel.sum() if kernel.sum() != 0 else 1
    return cv2.filter2D(img, -1, kernel)


def add_noise(img: np.ndarray, std_pct: float) -> np.ndarray:
    if std_pct <= 0:
        return img
    noise = np.random.normal(0, std_pct * 255.0, img.shape).astype(np.float32)
    noisy = clamp01(img.astype(np.float32) + noise)  # type: ignore
    return noisy.astype(np.uint8)


def jitter_corners(w: int, h: int, pct: float):
    def jx(x):
        return x + random.uniform(-pct, pct) * w

    def jy(y):
        return y + random.uniform(-pct, pct) * h

    return np.float32(
        [
            [jx(0), jy(0)],
            [jx(w), jy(0)],
            [jx(w), jy(h)],
            [jx(0), jy(h)],
        ]
    )


def perspective_warp(img: np.ndarray, pct: float) -> np.ndarray:
    h, w = img.shape[:2]
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = jitter_corners(w, h, pct)
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)


def crop(img: np.ndarray, pct: float) -> np.ndarray:
    if pct <= 0:
        return img
    h, w = img.shape[:2]
    dx, dy = int(w * pct), int(h * pct)
    return img[dy : h - dy, dx : w - dx]


def add_glare(img: np.ndarray, strength: float, radius_pct: float, center=None) -> np.ndarray:
    h, w = img.shape[:2]
    if center is None:
        center = (int(w * random.uniform(0.25, 0.75)), int(h * random.uniform(0.25, 0.4)))
    radius = int(min(w, h) * radius_pct)
    mask = np.zeros((h, w), dtype=np.float32)
    cv2.circle(mask, center, radius, 1.0, -1)
    mask = cv2.GaussianBlur(mask, (0, 0), radius * 0.4 + 1)
    glare = np.full_like(img, 255)
    blend = (img.astype(np.float32) * (1 - mask[..., None]) + glare.astype(np.float32) * mask[..., None])
    out = clamp01(blend / 255.0) * 255.0
    out = cv2.addWeighted(img, 1 - strength, out.astype(np.uint8), strength, 0)
    return out


def add_shadow(img: np.ndarray, strength: float, vertical: bool = True) -> np.ndarray:
    h, w = img.shape[:2]
    mask = np.linspace(0, strength, h if vertical else w, dtype=np.float32)
    if vertical:
        mask = mask[:, None]
    else:
        mask = mask[None, :]
    mask = np.tile(mask, (1, w) if vertical else (h, 1))
    dark = (img.astype(np.float32) * (1 - mask[..., None])).astype(np.uint8)
    return dark


def add_stains(img: np.ndarray, count: int = 6, max_radius: int = 30) -> np.ndarray:
    h, w = img.shape[:2]
    overlay = img.copy().astype(np.float32)
    for _ in range(count):
        r = random.randint(8, max_radius)
        cx = random.randint(r, w - r)
        cy = random.randint(r, h - r)
        color = random.uniform(0.2, 0.6)
        cv2.circle(overlay, (cx, cy), r, (255 * color,) * 3, -1)
    overlay = cv2.GaussianBlur(overlay, (0, 0), 3)
    return overlay.astype(np.uint8)


def resize_pad_to_match(ref: np.ndarray, target: np.ndarray) -> np.ndarray:
    th, tw = target.shape[:2]
    rh, rw = ref.shape[:2]
    if (rh, rw) == (th, tw):
        return target
    scale = min(rw / tw, rh / th)
    new_w, new_h = int(tw * scale), int(th * scale)
    resized = cv2.resize(target, (new_w, new_h), interpolation=cv2.INTER_AREA)
    canvas = np.full_like(ref, 255)
    x0 = (rw - new_w) // 2
    y0 = (rh - new_h) // 2
    canvas[y0 : y0 + new_h, x0 : x0 + new_w] = resized
    return canvas


def scenario_ops():
    return {
        "A1": [("ev", 0), ("warp", 0.03)],
        "A2": [("ev", 0), ("warp", 0.1)],
        "B1": [("ev", -1), ("gauss", 1.0), ("motion", (6, 0))],
        "B2": [("ev", -1), ("crop", 0.05), ("warp", 0.06)],
        "C1": [("ev", -2), ("noise", 0.08), ("gauss", 1.2)],
        "C2": [("ev", -2), ("glare", (0.35, 0.22)), ("warp", 0.04)],
        "D1": [("ev", 1), ("shadow", 0.45)],
        "D2": [("ev", 1), ("shadow", 0.4), ("glare", (0.4, 0.18)), ("warp", 0.08)],
        "E1": [("ev", 0), ("warp", 0.15)],
        "E2": [("ev", 0), ("crop", 0.1)],
        "F1": [("ev", 0), ("motion", (14, 90))],
        "F2": [("ev", 0), ("stain", 1), ("warp", 0.05)],
    }


def apply_ops(img: np.ndarray, ops):
    out = img.copy()
    h, w = out.shape[:2]
    for op in ops:
        kind = op[0]
        val = op[1] if len(op) > 1 else None
        if kind == "ev":
            out = adjust_ev(out, val)
        elif kind == "gamma":
            out = gamma(out, val)
        elif kind == "gauss":
            out = gaussian_blur(out, val)
        elif kind == "motion":
            length, angle = val
            out = motion_blur(out, length, angle)
        elif kind == "noise":
            out = add_noise(out, val)
        elif kind == "warp":
            out = perspective_warp(out, val)
            h, w = out.shape[:2]
        elif kind == "crop":
            out = crop(out, val)
            out = cv2.resize(out, (w, h), interpolation=cv2.INTER_AREA)
        elif kind == "glare":
            strength, radius_pct = val
            out = add_glare(out, strength=strength, radius_pct=radius_pct)
        elif kind == "shadow":
            out = add_shadow(out, val, vertical=True)
        elif kind == "stain":
            out = add_stains(out, count=8, max_radius=int(min(h, w) * 0.05))
        else:
            raise ValueError(f"Bilinmeyen op: {kind}")
    return out


def main():
    default_input = Path(__file__).resolve().parent / "input" / "filled-base.png"

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default=str(default_input),
        help=f"Doldurulmuş referans form PNG/JPG (varsayılan: {default_input})",
    )
    parser.add_argument("--out", default="benchmarks/output", help="Çıktı dizini")
    parser.add_argument(
        "--per",
        type=int,
        default=8,
        help="Her senaryoda üretilecek varyasyon sayısı (varsayılan: 8)",
    )
    parser.add_argument("--seed", type=int, default=42, help="Rastgelelik için seed")
    parser.add_argument("--results", default="benchmarks/results.csv", help="Sonuç şablonu CSV yolu")
    parser.add_argument("--fillThreshold", default="0.20", help="Varsayılan fillThreshold")
    parser.add_argument("--roi", default="1.04", help="Varsayılan ROI_SCALE (FILL_ROI_SCALE)")
    parser.add_argument("--mask", default="0.32", help="Varsayılan MASK_RATIO (FILL_MASK_RATIO)")
    parser.add_argument("--block", default="11", help="Varsayılan adaptive block size")
    parser.add_argument(
        "--no-template",
        dest="make_template",
        action="store_false",
        help="Sonuç şablonu (results.csv) oluşturma",
    )
    parser.add_argument(
        "--process",
        dest="process_results",
        action="store_true",
        help="Varyasyonları oluşturduktan sonra otomatik olarak process_variations.py çalıştır",
    )
    parser.set_defaults(make_template=True)
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)

    base_img = read_image(Path(args.input))
    scenarios = scenario_ops()
    outdir = Path(args.out)
    meta_rows = []

    for name, ops in scenarios.items():
        for i in range(args.per):
            var_seed = args.seed + i * 13 + hash(name) % 997
            random.seed(var_seed)
            np.random.seed(var_seed)
            img = apply_ops(base_img, ops)
            fname = f"{name.lower()}_{i+1}.png"
            out_path = outdir / name / fname
            write_image(out_path, img)
            meta_rows.append(
                {
                    "scenario": name,
                    "variant": i + 1,
                    "file": str(out_path),
                    "ops": ";".join([op[0] for op in ops]),
                }
            )

    # metadata CSV
    import csv

    meta_path = outdir / "metadata.csv"
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    with meta_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["scenario", "variant", "file", "ops"])
        writer.writeheader()
        writer.writerows(meta_rows)

    print(f"Üretim tamam: {len(meta_rows)} görüntü, meta: {meta_path}")

    if args.make_template:
        # Sonuç şablonu oluştur
        fieldnames = [
            "Scenario",
            "Variant",
            "Image",
            "fillThreshold",
            "ROI_SCALE",
            "MASK_RATIO",
            "BlockSize",
            "Dogru",
            "Yanlis",
            "Bos",
            "Coklu",
            "SupheliFlag",
            "MarkerOK",
            "OgrNoOK",
        ]
        results_path = Path(args.results)
        results_path.parent.mkdir(parents=True, exist_ok=True)
        with results_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for r in meta_rows:
                writer.writerow(
                    {
                        "Scenario": r["scenario"],
                        "Variant": r["variant"],
                        "Image": r["file"],
                        "fillThreshold": args.fillThreshold,
                        "ROI_SCALE": args.roi,
                        "MASK_RATIO": args.mask,
                        "BlockSize": args.block,
                        "Dogru": "",
                        "Yanlis": "",
                        "Bos": "",
                        "Coklu": "",
                        "SupheliFlag": "",
                        "MarkerOK": "",
                        "OgrNoOK": "",
                    }
                )
        print(f"Sonuç şablonu yazıldı: {results_path}")

    if args.process_results:
        try:
            from benchmarks import process_variations
        except ImportError:
            import process_variations  # type: ignore
        print("process_variations.py çalıştırılıyor...")
        process_variations.main()


if __name__ == "__main__":
    main()
