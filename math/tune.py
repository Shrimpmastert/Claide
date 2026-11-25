"""Fast raw stats (no weight fitting, no export) for tuning config.py.

    python tune.py [sims_per_mode]
"""
import random
import sys
from collections import Counter

import config as C
from game import play_round

n = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
for mode, spec in C.BET_MODES.items():
    rng = random.Random(f"tune-{mode}")
    k = n if mode == "base" else max(500, n // 10)
    p = [play_round(rng, i, mode)["payoutMultiplier"] / 100 for i in range(k)]
    buckets = Counter(min(b, 6) for b in ((0 if x == 0 else 1 if x < 1 else 2 if x < 5 else 3 if x < 20 else 4 if x < 100 else 5 if x < 1000 else 6) for x in p))
    print(f"{mode:6s} n={k} rtp={sum(p)/k/spec['cost']:.3f} hit={sum(x>0 for x in p)/k:.3f} "
          f"max={max(p):.0f}x  dist[0,<1,<5,<20,<100,<1000,1000+]={[buckets[i] for i in range(7)]}")
