"""
Benchmark sonuçlarından en iyi parametre setini seçer.

CSV beklenen sütunlar:
Scenario,Variant,fillThreshold,ROI_SCALE,MASK_RATIO,BlockSize,Dogru,Yanlis,Bos,Coklu,SupheliFlag,MarkerOK,OgrNoOK

Kullanım (varsayılan CSV: benchmarks/output/metadata.csv):
  python3 benchmarks/select_best.py
  python3 benchmarks/select_best.py --csv benchmarks/results.csv
"""
import argparse
import csv
from collections import defaultdict


def accuracy(row):
    def num(val):
        try:
            return float(val)
        except Exception:
            return 0.0

    d = num(row.get("Dogru", 0))
    y = num(row.get("Yanlis", 0))
    b = num(row.get("Bos", 0))
    total = d + y + b
    return d / total if total else 0.0


def score_row(row):
    acc = accuracy(row)
    marker_ok = 1.0 if row.get("MarkerOK", "").lower() in ("1", "ok", "true") else 0.0
    ogr_ok = 1.0 if row.get("OgrNoOK", "").lower() in ("1", "ok", "true") else 0.0
    supheli_flag = row.get("SupheliFlag", "").lower() in ("1", "true", "yes", "var")
    # Hafif avantaj: marker ve ogrenci no doğruluğu, hafif ceza: şüpheli flag
    return acc + 0.02 * marker_ok + 0.02 * ogr_ok - (0.01 if supheli_flag else 0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--csv",
        default="benchmarks/results.csv",
        help="Sonuçlar CSV yolu (varsayılan: benchmarks/results.csv)",
    )
    args = parser.parse_args()

    with open(args.csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    required = [
        "fillThreshold",
        "ROI_SCALE",
        "MASK_RATIO",
        "BlockSize",
        "Dogru",
        "Yanlis",
        "Bos",
    ]
    missing = [c for c in required if rows and c not in rows[0]]
    if missing:
        print(
            f"CSV beklenen sütunları içermiyor ({args.csv}). Eksik: " + ", ".join(missing)
            + "\nŞablon: Scenario,Variant,fillThreshold,ROI_SCALE,MASK_RATIO,BlockSize,Dogru,Yanlis,Bos,Coklu,SupheliFlag,MarkerOK,OgrNoOK",
        )
        return

    groups = defaultdict(list)
    for r in rows:
        key = (
            r["fillThreshold"],
            r["ROI_SCALE"],
            r["MASK_RATIO"],
            r["BlockSize"],
        )
        groups[key].append(r)

    best = None
    best_score = -1
    for key, items in groups.items():
        scores = [score_row(r) for r in items]
        avg = sum(scores) / len(scores)
        if avg > best_score:
            best_score = avg
            best = key

    if best is None:
        print("Veri yok.")
        return

    print("En iyi parametre seti:")
    print(f"fillThreshold={best[0]}, ROI_SCALE={best[1]}, MASK_RATIO={best[2]}, BlockSize={best[3]}")
    print(f"Ortalama skor: {best_score:.4f} (senaryo sayısı: {len(groups[best])})")


if __name__ == "__main__":
    main()
