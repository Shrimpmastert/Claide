"""Goblin Tunnels: all tunable numbers live here.

Values marked PLACEHOLDER were not in the design doc and were filled in
so the model runs end to end. Tune them, re-run `python run.py`, and
check the printed RTP / hit rate / max win.
"""

GAME_ID = "goblin_tunnels"
TUNNELS = 5
LAYERS = 6                      # layers 1..6 below the surface row (layer 0)
TARGET_RTP = 0.965              # PLACEHOLDER
WIN_CAP = 5000.0                # PLACEHOLDER: max win in x bet

# Zones from the design doc: layer -> zone name
ZONE_OF_LAYER = {1: "topsoil", 2: "topsoil", 3: "stone", 4: "stone", 5: "deep", 6: "deep"}

# Treasure values in x bet. PLACEHOLDER
TREASURE_VALUES = {
    "coin": 0.2,
    "ring": 0.6,
    "gem": 1.2,
    "crown": 6.0,
    "hoard": 25.0,
}
BLANKS = ("dirt", "rock", "bones")
BOULDER = "boulder"
BOULDER_COST = 2                # dig power needed to break a boulder. PLACEHOLDER

# Per-zone symbol weights. "Deeper = better odds of high values". PLACEHOLDER
SYMBOL_WEIGHTS = {
    "basegame": {
        "topsoil": {"dirt": 80, "rock": 22, "bones": 16, "coin": 12, "ring": 5, "gem": 2},
        "stone":   {"dirt": 30, "rock": 25, "bones": 12, "boulder": 14, "coin": 10, "ring": 12, "gem": 14, "crown": 4},
        "deep":    {"dirt": 20, "rock": 25, "bones": 15, "boulder": 12, "ring": 8, "gem": 14, "crown": 8, "hoard": 2},
    },
    "freegame": {
        "topsoil": {"dirt": 50, "rock": 15, "bones": 10, "coin": 25, "ring": 12, "gem": 4},
        "stone":   {"dirt": 25, "rock": 20, "bones": 10, "boulder": 12, "coin": 8, "ring": 14, "gem": 18, "crown": 7},
        "deep":    {"dirt": 18, "rock": 22, "bones": 14, "boulder": 10, "ring": 8, "gem": 14, "crown": 9, "hoard": 3},
    },
}

# Surface row: each tunnel independently gets a goblin, a Mine Map, or nothing.
# At most one item per tunnel (doc: "at most one per tunnel"). PLACEHOLDER
SURFACE_WEIGHTS = {
    "basegame": {"goblin": 24, "map": 6, "empty": 70},
    "freegame": {"goblin": 50, "map": 3, "empty": 47},
}

# Helmet dig power 1..6 (doc). PLACEHOLDER weights
DIG_POWER_WEIGHTS = {
    "basegame": {1: 26, 2: 26, 3: 20, 4: 13, 5: 9, 6: 6},
    "freegame": {1: 12, 2: 18, 3: 22, 4: 20, 5: 15, 6: 13},
}

# Merging. PLACEHOLDER rules:
# When a goblin stops at the same depth as the goblin in the tunnel to its
# left, they break through the wall and merge. The merged goblin pools both
# hauls, takes the multiplier for its new size, and gets MERGE_BONUS_POWER
# extra dig power to keep going down.
MERGE_MULTIPLIER = {1: 1, 2: 2, 3: 5, 4: 10, 5: 25}   # size -> multiplier
MERGE_BONUS_POWER = 1

# Mine Map scatter -> free spins. PLACEHOLDER
FREE_SPINS_FOR_MAPS = {3: 8, 4: 10, 5: 12}
RETRIGGER_SPINS = 5             # 3+ maps during free spins
# Free spins only: persistent Mine Multiplier starts at x1 and gains this much
# per merge for the rest of the bonus. Applied to each spin's win. PLACEHOLDER
FREE_SPIN_MULT_PER_MERGE = 1

# Bet modes for Stake Engine.
BET_MODES = {
    "base":  {"cost": 1.0,   "sims": 200_000},
    "bonus": {"cost": 100.0, "sims": 20_000},   # bonus buy: forced 3+ Mine Maps
}
