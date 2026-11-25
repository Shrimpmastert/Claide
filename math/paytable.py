"""Write web/data/paytable.json from config.py + library/stats.json.

The front end's rules screen reads this, so displayed values always match
the math. run.py calls it automatically; run it alone after editing text.
"""
import json
import os

import config as C

ROOT = os.path.dirname(os.path.abspath(__file__))
STATS = os.path.join(ROOT, "..", "library", "stats.json")
OUT = os.path.join(ROOT, "..", "web", "data", "paytable.json")


def write():
    stats = json.load(open(STATS)) if os.path.exists(STATS) else {}
    data = {
        "game": C.GAME_ID,
        "tunnels": C.TUNNELS,
        "layers": C.LAYERS,
        "maxWin": C.WIN_CAP,
        "treasures": C.TREASURE_VALUES,
        "boulderCost": C.BOULDER_COST,
        "mergeMultiplier": {str(k): v for k, v in C.MERGE_MULTIPLIER.items()},
        "mergeBonusPower": C.MERGE_BONUS_POWER,
        "freeSpins": {str(k): v for k, v in C.FREE_SPINS_FOR_MAPS.items()},
        "retrigger": {str(k): v for k, v in C.RETRIGGER_SPINS.items()},
        "freeMult": {"start": C.FREE_SPIN_START_MULT, "perMerge": C.FREE_SPIN_MULT_PER_MERGE},
        "superMult": {"start": C.SUPER_START_MULT, "perMerge": C.SUPER_MULT_PER_MERGE},
        "mysterySpinChance": C.MYSTERY_SPIN_CHANCE,
        "modes": {m: {"cost": s["cost"], "kind": s["kind"],
                      "rtp": round(stats.get(m, {}).get("rtp", C.TARGET_RTP), 4)}
                  for m, s in C.BET_MODES.items()},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, indent=2)


if __name__ == "__main__":
    write()
