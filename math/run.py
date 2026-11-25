"""Simulate every bet mode, fit lookup-table weights to the target RTP and
write Stake Engine math files to ../library/publish_files plus small sample
book files for the web front end.

    python run.py            # full run (sims per mode from config)
    python run.py --quick    # 10x fewer sims, for tuning
"""
import argparse
import csv
import json
import math
import os
import random
import sys
from multiprocessing import Pool

import zstandard

import config as C
from game import play_round
import paytable

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "..", "library", "publish_files")
WEB_BOOKS = os.path.join(ROOT, "..", "web", "books")
WEIGHT_SCALE = 1_000_000


CHUNK = 5000


def sim_chunk(job):
    seed, mode, start, count = job
    rng = random.Random(f"{seed}-{mode}-{start}")
    return [play_round(rng, start + i + 1, mode) for i in range(count)]


def fit_weights(payouts, cost, target):
    """Exponential tilt w_i = exp(-lam * x_i) so the weighted RTP hits target.

    lam > 0 lowers RTP, lam < 0 raises it. Bisection on lam."""
    xs = [p / 100 / cost for p in payouts]   # return per unit cost

    def rtp(lam):
        num = den = 0.0
        for x in xs:
            w = math.exp(-lam * x)
            num += w * x
            den += w
        return num / den

    # Bound |lam * x| <= 20 so weights stay well inside uint64.
    bound = min(0.5, 20 / max(max(xs), 1e-9))
    lo, hi = -bound, bound
    if not (rtp(hi) <= target <= rtp(lo)):
        sys.exit(f"Raw RTP too far from target to fit (range {rtp(hi):.3f}..{rtp(lo):.3f}). Retune config.")
    for _ in range(80):
        mid = (lo + hi) / 2
        if rtp(mid) > target:
            lo = mid
        else:
            hi = mid
    lam = (lo + hi) / 2
    return [max(1, round(WEIGHT_SCALE * math.exp(-lam * x))) for x in xs], lam


def stats(payouts, weights, cost):
    tw = sum(weights)
    rtp = sum(w * p for w, p in zip(weights, payouts)) / 100 / cost / tw
    hit = sum(w for w, p in zip(weights, payouts) if p > 0) / tw
    mean = rtp * cost
    var = sum(w * (p / 100 - mean) ** 2 for w, p in zip(weights, payouts)) / tw
    return {"rtp": rtp, "hit_rate": hit, "max_win": max(payouts) / 100,
            "std_dev": math.sqrt(var) / cost}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--seed", type=int, default=20261125)
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    os.makedirs(WEB_BOOKS, exist_ok=True)
    index = {"modes": []}
    report = {}
    for mode, spec in C.BET_MODES.items():
        n = spec["sims"] // (10 if args.quick else 1)
        chunks = [(args.seed, mode, start, min(CHUNK, n - start)) for start in range(0, n, CHUNK)]
        with Pool() as pool:
            books = [b for part in pool.map(sim_chunk, chunks) for b in part]
        payouts = [b["payoutMultiplier"] for b in books]
        raw_rtp = sum(payouts) / 100 / spec["cost"] / n
        weights, lam = fit_weights(payouts, spec["cost"], C.TARGET_RTP)
        s = stats(payouts, weights, spec["cost"])
        s.update({"sims": n, "raw_rtp": raw_rtp, "tilt_lambda": lam,
                  "free_spin_rate": sum(1 for b in books if "freegame" in b["criteria"]) / n,
                  "super_rate": sum(1 for b in books if b["criteria"] == "superfreegame") / n})
        report[mode] = s
        print(f"{mode:6s} sims={n:>7} raw_rtp={raw_rtp:.4f} rtp={s['rtp']:.4f} "
              f"hit={s['hit_rate']:.3f} max={s['max_win']:.0f}x sd={s['std_dev']:.2f} lam={lam:+.4f}")

        books_name = f"books_{mode}.jsonl.zst"
        weights_name = f"lookUpTable_{mode}_0.csv"
        cctx = zstandard.ZstdCompressor(level=12, threads=-1)
        payload = "\n".join(json.dumps(b, separators=(",", ":")) for b in books).encode()
        with open(os.path.join(OUT, books_name), "wb") as f:
            f.write(cctx.compress(payload))
        with open(os.path.join(OUT, weights_name), "w", newline="") as f:
            w = csv.writer(f)
            for b, wt in zip(books, weights):
                w.writerow([b["id"], wt, b["payoutMultiplier"]])
        index["modes"].append({"name": mode, "cost": spec["cost"], "events": books_name, "weights": weights_name})

        # Sample for the local web demo: weighted draw plus the biggest wins.
        srng = random.Random(1)
        sample = srng.choices(books, weights=weights, k=300 if spec["kind"] == "spin" and mode != "feature" else 60)
        sample += sorted(books, key=lambda b: -b["payoutMultiplier"])[:5]
        with open(os.path.join(WEB_BOOKS, f"{mode}.json"), "w") as f:
            json.dump(sample, f, separators=(",", ":"))

    with open(os.path.join(OUT, "index.json"), "w") as f:
        json.dump(index, f, indent=2)
    with open(os.path.join(ROOT, "..", "library", "stats.json"), "w") as f:
        json.dump(report, f, indent=2)
    paytable.write()


if __name__ == "__main__":
    main()
