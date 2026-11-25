"""Fast raw stats (no weight fitting, no export) for tuning config.py.

    python tune.py [base_sims] [mode ...]
"""
import random
import sys
from collections import Counter
from multiprocessing import Pool

import config as C
from game import play_round


def run(job):
    mode, k = job
    rng = random.Random(f"tune-{mode}")
    books = [play_round(rng, i, mode) for i in range(k)]
    return mode, k, books


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    modes = sys.argv[2:] or list(C.BET_MODES)
    jobs = [(m, n if C.BET_MODES[m]["kind"] == "spin" and m != "feature" else max(500, n // 10)) for m in modes]
    with Pool() as pool:
        for mode, k, books in pool.imap(run, jobs):
            cost = C.BET_MODES[mode]["cost"]
            p = [b["payoutMultiplier"] / 100 for b in books]
            crit = Counter(b["criteria"] for b in books)
            fs = crit["freegame"] + crit["superfreegame"]
            edges = [0, 1, 5, 20, 100, 1000, float("inf")]
            dist = [sum(1 for x in p if x == 0)] + [sum(1 for x in p if 0 < x and edges[i] <= x < edges[i + 1] or (i == 0 and 0 < x < 1)) for i in range(6)]
            print(f"{mode:7s} n={k:<6} cost={cost:<6} rtp={sum(p)/k/cost:.3f} avg={sum(p)/k:8.2f}x "
                  f"hit={sum(x>0 for x in p)/k:.3f} fs=1/{k/max(fs,1):.0f} super={crit['superfreegame']/max(fs,1):.2f} "
                  f"max={max(p):.0f}x dist[0,<1,<5,<20,<100,<1000,1000+]={dist}")


if __name__ == "__main__":
    main()
