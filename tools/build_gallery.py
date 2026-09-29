"""
현장 사진 → 갤러리 등록 스크립트

사용법:
    python tools/build_gallery.py "<원본 사진 폴더>"

하는 일:
  1. 폴더 안 JPG/PNG 의 촬영일시(EXIF)를 읽는다. 없으면 파일 수정시각을 쓴다.
  2. 회전 정보를 반영해 WebP 두 벌을 만든다.
       assets/img/gallery/YYYYMMDD_HHMMSS.webp     (긴 변 1600px, 확대 보기용)
       assets/img/gallery/YYYYMMDD_HHMMSS_t.webp   (긴 변 720px, 목록용)
  3. assets/js/gallery-data.js 를 촬영일시 순으로 다시 쓴다.
     이미 적어 둔 사진 설명(caption)·날짜 제목(days)은 그대로 보존된다.

새 사진을 추가할 때는 같은 명령을 다시 실행하고,
gallery-data.js 에서 새 항목의 caption 만 채우면 된다.
"""
import json, os, sys, glob
from datetime import datetime
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 사이트 루트
OUT_DIR = os.path.join(ROOT, "assets", "img", "gallery")
DATA = os.path.join(ROOT, "assets", "js", "gallery-data.js")
PREFIX = "window.GALLERY = "

FULL, THUMB = 1600, 720


def shot_time(path, im):
    """EXIF 촬영일시 → datetime (없으면 파일 수정시각)"""
    ex = im.getexif()
    raw = ex.get_ifd(0x8769).get(36867) or ex.get(306)
    if raw:
        try:
            return datetime.strptime(str(raw).strip(), "%Y:%m:%d %H:%M:%S")
        except ValueError:
            pass
    return datetime.fromtimestamp(os.path.getmtime(path))


def load_data():
    if not os.path.exists(DATA):
        return {"days": {}, "photos": []}
    txt = open(DATA, encoding="utf-8").read()
    body = txt[txt.index(PREFIX) + len(PREFIX):].rstrip().rstrip(";")
    return json.loads(body)


def save(im, path, size, quality):
    im = im.copy()
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(path, "WEBP", quality=quality, method=6)
    return im.size


def main(src):
    os.makedirs(OUT_DIR, exist_ok=True)
    data = load_data()
    known = {p["id"]: p for p in data["photos"]}
    by_source = {p.get("source"): p["id"] for p in data["photos"]}

    files = sorted(f for f in glob.glob(os.path.join(src, "*"))      # 확장자 대소문자 무관
                   if os.path.splitext(f)[1].lower() in (".jpg", ".jpeg", ".png"))
    added = 0
    for f in files:
        with Image.open(f) as raw:
            t = shot_time(f, raw)
            src_key = f"{t:%Y%m%d_%H%M%S}/{os.path.basename(f)}"
            if src_key in by_source:                     # 이미 등록된 사진
                continue
            pid = f"{t:%Y%m%d_%H%M%S}"
            n = 2
            while pid in known:                          # 같은 초에 찍힌 사진
                pid = f"{t:%Y%m%d_%H%M%S}_{n}"; n += 1
            im = ImageOps.exif_transpose(raw).convert("RGB")
            w, h = save(im, os.path.join(OUT_DIR, pid + ".webp"), FULL, 80)
            save(im, os.path.join(OUT_DIR, pid + "_t.webp"), THUMB, 72)
        known[pid] = {
            "id": pid,
            "date": f"{t:%Y-%m-%d}",
            "time": f"{t:%H:%M}",
            "w": w, "h": h,
            "caption": "",
            "source": src_key,
        }
        added += 1

    photos = sorted(known.values(), key=lambda p: (p["date"], p["time"], p["id"]))
    for p in photos:                                     # 새 날짜는 빈 제목으로 자리만 만든다
        data["days"].setdefault(p["date"], {"title": "", "note": ""})
    out = {"days": dict(sorted(data["days"].items())), "photos": photos}
    with open(DATA, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("/* 갤러리 데이터 — tools/build_gallery.py 가 생성합니다.\n"
                 "   caption(사진 설명)과 days(날짜별 제목·설명)만 손으로 고치면 됩니다. */\n")
        fh.write(PREFIX + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
    print(f"추가 {added}장 · 전체 {len(photos)}장 · 날짜 {len(out['days'])}일")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("사용법: python tools/build_gallery.py <원본 사진 폴더>")
    main(sys.argv[1])
