"""
Playwright kullanmadan OMR benchmark sonuçlarını doldurmak için OpenCV tabanlı hızlı okuyucu.
- filled-base.png'yi cevap anahtarı olarak kullanır (en yüksek skorlu şıkkı anahtar kabul eder)
- benchmarks/output içindeki tüm PNG varyasyonlarını okur
- benchmarks/results.csv dosyasını Dogru/Yanlis/Bos/Coklu/SupheliFlag/MarkerOK/OgrNoOK alanlarıyla doldurur

Not: Bu, tarayıcıdaki OMR ile aynı olmayabilir ama hızlı bir benchmark doldurucusudur.
"""
import csv
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
BASE_IMG = ROOT / "benchmarks/input/filled-base.png"
RESULTS_CSV = ROOT / "benchmarks/results.csv"

MARKER_OFFSET = 5
MARKER_SIZE = 18
MARKER_INNER = 6
FILL_ROI_SCALE = 1.04
FILL_MASK_RATIO = 0.32
BLANK_GUARD = 0.18
THRESHOLD = 0.20


@dataclass
class Choice:
    option: str
    x: float
    y: float
    width: float
    height: float


@dataclass
class Question:
    number: int
    choices: List[Choice]


@dataclass
class Layout:
    width: int
    height: int
    questions: List[Question]


def generate_layout() -> Layout:
    cfg = {
        "questionCount": 30,
        "choiceCount": 5,
        "columnCount": 2,
        "studentDigits": 10,
        "formWidth": 350,
        "formHeight": 550,
        "bubbleSize": 14,
        "rowGap": 4,
        "headerRepeat": 5,
    }
    margin = 15
    bubble_size = cfg["bubbleSize"]
    bubble_r = bubble_size / 2
    bubble_gap = bubble_size + 3
    row_h = bubble_size + cfg["rowGap"]

    questions_per_col = math.ceil(cfg["questionCount"] / cfg["columnCount"])
    column_width = (cfg["formWidth"] - margin * 2) / cfg["columnCount"]

    # Header heights (student + answer key)
    qr_size = 60
    digit_bubble_size = min(cfg["bubbleSize"] - 2, 12)
    digit_gap = digit_bubble_size + 2
    student_start_x = margin + qr_size + 15
    student_start_y = margin + 10
    header_height = 20 + 10 * (digit_bubble_size + 2) + 15
    y_start = student_start_y + header_height + 10

    layout_questions: List[Question] = []
    letters = list("ABCDE")[: cfg["choiceCount"]]
    header_repeat = cfg["headerRepeat"]

    for col in range(cfg["columnCount"]):
        col_x = margin + col * column_width
        label_start_x = col_x + 25
        extra_offset = 0
        for q_idx in range(questions_per_col):
            q_num = col * questions_per_col + q_idx + 1
            if q_num > cfg["questionCount"]:
                break
            if q_idx > 0 and q_idx % header_repeat == 0:
                extra_offset += row_h * 0.8
            q_y = y_start + 12 + q_idx * row_h + extra_offset
            choices: List[Choice] = []
            for c, letter in enumerate(letters):
                bx = label_start_x + c * bubble_gap
                choices.append(
                    Choice(
                        option=letter,
                        x=bx / cfg["formWidth"],
                        y=(q_y + bubble_r) / cfg["formHeight"],
                        width=bubble_size / cfg["formWidth"],
                        height=bubble_size / cfg["formHeight"],
                    )
                )
            layout_questions.append(Question(number=q_num, choices=choices))
    return Layout(width=cfg["formWidth"], height=cfg["formHeight"], questions=layout_questions)


def detect_markers(binary: np.ndarray) -> Optional[Dict[str, Tuple[float, float]]]:
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    img_area = binary.shape[0] * binary.shape[1]
    candidates = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < img_area * 0.0003 or area > img_area * 0.02:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        aspect = w / h
        if 0.5 < aspect < 2:
            hull = cv2.convexHull(cnt)
            solidity = area / cv2.contourArea(hull)
            if solidity > 0.6:
                candidates.append({"center": (x + w / 2, y + h / 2)})
    if len(candidates) < 4:
        return None

    cx, cy = binary.shape[1] / 2, binary.shape[0] / 2
    corners = {"tl": None, "tr": None, "bl": None, "br": None}
    dists = {"tl": 1e9, "tr": 1e9, "bl": 1e9, "br": 1e9}
    for c in candidates:
        x, y = c["center"]
        left, top = x < cx, y < cy
        dist = lambda X, Y: math.hypot(x - X, y - Y)
        if left and top and dist(0, 0) < dists["tl"]:
            dists["tl"] = dist(0, 0)
            corners["tl"] = c["center"]
        if not left and top and dist(binary.shape[1], 0) < dists["tr"]:
            dists["tr"] = dist(binary.shape[1], 0)
            corners["tr"] = c["center"]
        if left and not top and dist(0, binary.shape[0]) < dists["bl"]:
            dists["bl"] = dist(0, binary.shape[0])
            corners["bl"] = c["center"]
        if not left and not top and dist(binary.shape[1], binary.shape[0]) < dists["br"]:
            dists["br"] = dist(binary.shape[1], binary.shape[0])
            corners["br"] = c["center"]

    if any(v is None for v in corners.values()):
        return None
    return corners  # type: ignore


def warp(img: np.ndarray, corners, layout: Layout) -> np.ndarray:
    w, h = layout.width, layout.height
    mc = MARKER_OFFSET + MARKER_SIZE / 2
    src = np.float32(
        [corners["tl"], corners["tr"], corners["br"], corners["bl"]]
    )
    dst = np.float32(
        [
            [mc, mc],
            [w - mc, mc],
            [w - mc, h - mc],
            [mc, h - mc],
        ]
    )
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, M, (w, h))


def score_bubbles(binary: np.ndarray, question: Question) -> List[Tuple[str, float]]:
    h, w = binary.shape[:2]
    scores = []
    for c in question.choices:
        roi_w = int(round(c.width * w * FILL_ROI_SCALE))
        roi_h = int(round(c.height * h * FILL_ROI_SCALE))
        x = max(0, int(round(c.x * w - roi_w / 2)))
        y = max(0, int(round(c.y * h - roi_h / 2)))
        roi_w = min(roi_w, w - x)
        roi_h = min(roi_h, h - y)
        if roi_w <= 0 or roi_h <= 0:
            scores.append((c.option, 0.0))
            continue
        roi = binary[y : y + roi_h, x : x + roi_w]
        r = int(min(roi_h, roi_w) * FILL_MASK_RATIO)
        mask = np.zeros_like(roi, dtype=np.uint8)
        cv2.circle(mask, (roi_w // 2, roi_h // 2), r, 255, -1)
        masked = cv2.bitwise_and(roi, mask)
        mask_area = cv2.countNonZero(mask)
        score = cv2.countNonZero(masked) / mask_area if mask_area else 0.0
        scores.append((c.option, score))
    return scores


def read_form(img_path: Path, layout: Layout, answer_key: Optional[Dict[int, str]] = None):
    img = cv2.imread(str(img_path))
    if img is None:
        return {"error": "image read fail"}
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )
    corners = detect_markers(binary)
    if not corners:
        return {"error": "marker not found"}
    warped = warp(img, corners, layout)
    w_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    w_blur = cv2.GaussianBlur(w_gray, (5, 5), 0)
    w_bin = cv2.adaptiveThreshold(
        w_blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )

    perq = []
    correct = wrong = blank = multi = 0
    key_result: Dict[int, str] = {}
    for q in layout.questions:
        scores = score_bubbles(w_bin, q)
        max_score = max(s for _, s in scores)
        if max_score < BLANK_GUARD:
            marked = "-"
            status = "Boş"
            blank += 1
        else:
            filled = [(opt, s) for opt, s in scores if s >= THRESHOLD]
            if len(filled) > 1:
                multi += 1
                marked = max(filled, key=lambda x: x[1])[0] + "*"
                status = "Çoklu"
            elif len(filled) == 1:
                marked = filled[0][0]
                status = "İşaretli"
            else:
                # Seçilen yok ama yüksek bir aday varsa al
                best = max(scores, key=lambda x: x[1])
                if best[1] > 0.05:
                    marked = best[0]
                    status = "İşaretli"
                else:
                    marked = "-"
                    status = "Boş"
                    blank += 1
        key_result[q.number] = marked.replace("*", "")
        if answer_key:
            key = answer_key.get(q.number)
            if marked == "-" or not key:
                blank += 0
            elif key == marked.replace("*", ""):
                correct += 1
                status = "Doğru"
            else:
                wrong += 1
                status = "Yanlış"
        perq.append({"q": q.number, "marked": marked, "status": status, "maxScore": f"{max_score:.2f}"})

    return {
        "correct": correct,
        "wrong": wrong,
        "blank": blank,
        "multi": multi,
        "perQuestion": perq,
        "answerKey": key_result,
        "marker_ok": True,
    }


def main():
    layout = generate_layout()
    if not BASE_IMG.exists():
        raise SystemExit(f"Base image yok: {BASE_IMG}")
    base = read_form(BASE_IMG, layout, answer_key=None)
    if "error" in base:
        raise SystemExit(f"Base okuma hatası: {base['error']}")
    answer_key = base["answerKey"]

    # results.csv oku
    rows = []
    with RESULTS_CSV.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    for r in rows:
        img_path = Path(ROOT / r["Image"])
        result = read_form(img_path, layout, answer_key=answer_key)
        if "error" in result:
            r["Dogru"] = r["Yanlis"] = r["Bos"] = r["Coklu"] = "0"
            r["SupheliFlag"] = "1"
            r["MarkerOK"] = "0"
            r["OgrNoOK"] = "0"
            continue
        r["Dogru"] = str(result["correct"])
        r["Yanlis"] = str(result["wrong"])
        r["Bos"] = str(result["blank"])
        r["Coklu"] = str(result["multi"])
        r["SupheliFlag"] = "0" if result["marker_ok"] else "1"
        r["MarkerOK"] = "1" if result["marker_ok"] else "0"
        r["OgrNoOK"] = "0"  # Öğrenci no okunmuyor bu betikte

    with RESULTS_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    print(f"Güncellendi: {RESULTS_CSV}")


if __name__ == "__main__":
    main()
