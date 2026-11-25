"""Package Goblin Tunnels for Stake Engine.

    python build.py              # validate + build dist/
    python build.py --with-demo  # also ship the demo sample rounds

Produces:
    dist/math/      upload on the game's Files page as the math (index.json,
                    books_*.jsonl.zst, lookUpTable_*_0.csv)
    dist/frontend/  upload as the front end (index.html at the root)

Run `python math/run.py` first so library/publish_files/ exists.
"""
import argparse
import csv
import io
import json
import os
import shutil
import sys

import zstandard

ROOT = os.path.dirname(os.path.abspath(__file__))
MATH_SRC = os.path.join(ROOT, "library", "publish_files")
WEB_SRC = os.path.join(ROOT, "web")
DIST = os.path.join(ROOT, "dist")
sys.path.insert(0, os.path.join(ROOT, "math"))
import config as C  # noqa: E402

errors, warnings = [], []


def check_math():
    idx_path = os.path.join(MATH_SRC, "index.json")
    if not os.path.exists(idx_path):
        sys.exit("library/publish_files/index.json missing: run `python math/run.py` first.")
    index = json.load(open(idx_path))
    names = [m["name"] for m in index["modes"]]
    if set(names) != set(C.BET_MODES):
        errors.append(f"index.json modes {names} don't match config {list(C.BET_MODES)}")
    cap = round(C.WIN_CAP * 100)
    for m in index["modes"]:
        name = m["name"]
        for key in ("name", "cost", "events", "weights"):
            if key not in m:
                errors.append(f"{name}: index.json entry missing '{key}'")
        if m.get("cost") != C.BET_MODES.get(name, {}).get("cost"):
            errors.append(f"{name}: cost {m.get('cost')} != config")
        lut = {}
        with open(os.path.join(MATH_SRC, m["weights"])) as f:
            for row in csv.reader(f):
                i, w, p = (int(x) for x in row)
                if not (0 < w < 2 ** 64):
                    errors.append(f"{name}: weight out of uint64 range for id {i}")
                lut[i] = (w, p)
        seen, max_p = 0, 0
        dctx = zstandard.ZstdDecompressor()
        with open(os.path.join(MATH_SRC, m["events"]), "rb") as fh:
            text = io.TextIOWrapper(dctx.stream_reader(fh), encoding="utf-8")
            for line in text:
                if not line.strip():
                    continue
                b = json.loads(line)
                seen += 1
                if not isinstance(b.get("payoutMultiplier"), int):
                    errors.append(f"{name}: book {b.get('id')} payoutMultiplier not int"); continue
                if b["id"] not in lut:
                    errors.append(f"{name}: book {b['id']} missing from lookup table"); continue
                if lut[b["id"]][1] != b["payoutMultiplier"]:
                    errors.append(f"{name}: book {b['id']} payout {b['payoutMultiplier']} != lookup {lut[b['id']][1]}")
                fin = b["events"][-1]
                if fin.get("type") != "finalWin" or fin.get("amount") != b["payoutMultiplier"]:
                    errors.append(f"{name}: book {b['id']} finalWin doesn't match payoutMultiplier")
                if b["payoutMultiplier"] > cap:
                    errors.append(f"{name}: book {b['id']} exceeds max win")
                max_p = max(max_p, b["payoutMultiplier"])
        if seen != len(lut):
            errors.append(f"{name}: {seen} books vs {len(lut)} lookup rows")
        tw = sum(w for w, _ in lut.values())
        rtp = sum(w * p for w, p in lut.values()) / tw / 100 / m["cost"]
        hit = sum(w for w, p in lut.values() if p > 0) / tw
        if abs(rtp - C.TARGET_RTP) > 0.0005:
            errors.append(f"{name}: RTP {rtp:.4f} off target {C.TARGET_RTP}")
        print(f"  {name:8s} cost {m['cost']:>6}  books {seen:>7}  RTP {rtp*100:.2f}%  hit {hit*100:.1f}%  max {max_p/100:.0f}x")
    return index


def check_art():
    src = open(os.path.join(WEB_SRC, "src", "assets.js")).read()
    import re
    missing = []
    for key, path in re.findall(r"^\s*(\w+): '([^']+)'", src, re.M):
        if not os.path.exists(os.path.join(WEB_SRC, "assets", path)) and not key.startswith(("goblin_", "music", "page_bg")):
            missing.append(path)
    if missing:
        warnings.append(f"{len(missing)} art/sound slots still use placeholders (see web/assets/README.md):\n      "
                        + "\n      ".join(missing))


def build(with_demo):
    shutil.rmtree(DIST, ignore_errors=True)
    shutil.copytree(MATH_SRC, os.path.join(DIST, "math"))
    ignore = ["README.md", ".gitkeep", ".DS_Store"]
    if not with_demo:
        ignore.append("books")
    shutil.copytree(WEB_SRC, os.path.join(DIST, "frontend"), ignore=shutil.ignore_patterns(*ignore))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(os.path.join(DIST, "frontend")) for f in fs)
    print(f"  frontend: {size/1e6:.2f} MB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--with-demo", action="store_true")
    args = ap.parse_args()
    print("Checking math files…")
    check_math()
    if not os.path.exists(os.path.join(WEB_SRC, "data", "paytable.json")):
        errors.append("web/data/paytable.json missing: run `python math/paytable.py`")
    check_art()
    for w in warnings:
        print("WARNING:", w)
    if errors:
        print("\nERRORS:")
        for e in errors[:50]:
            print("  -", e)
        sys.exit(1)
    print("Building dist/…")
    build(args.with_demo)
    print("Done. Upload dist/math and dist/frontend in the Stake Engine dashboard.")


if __name__ == "__main__":
    main()
