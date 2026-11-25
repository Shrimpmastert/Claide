"""Goblin Tunnels: all tunable numbers live here.

Values marked PLACEHOLDER were not in the design doc and were filled in
so the model runs end to end. Tune them, re-run `python run.py`, and
check the printed RTP / hit rate / max win.
"""

GAME_ID = "goblin_tunnels"
TUNNELS = 5
LAYERS = 6                      # layers 1..6 below the surface row (layer 0)
TARGET_RTP = 0.965              # PLACEHOLDER
WIN_CAP = 10000.0               # PLACEHOLDER: max win in x bet (all modes)

# Zones from the design doc: layer -> zone name
ZONE_OF_LAYER = {1: "topsoil", 2: "topsoil", 3: "stone", 4: "stone", 5: "deep", 6: "deep"}

# Treasure values in x bet. PLACEHOLDER
TREASURE_VALUES = {
    "coin": 0.2,
    "ring": 0.5,
    "gem": 1.2,
    "crown": 6.0,
    "hoard": 25.0,
}
BLANKS = ("dirt", "rock", "bones")
BOULDER = "boulder"
MYSTERY = "mystery"              # Mystery Ore: turns into the spin's mystery treasure when dug
BOULDER_COST = 2                # dig power needed to break a boulder. PLACEHOLDER

# Per-zone symbol weights. "Deeper = better odds of high values". PLACEHOLDER
SYMBOL_WEIGHTS = {
    "basegame": {
        "topsoil": {"dirt": 80, "rock": 22, "bones": 16, "coin": 12, "ring": 5, "gem": 2},
        "stone":   {"dirt": 30, "rock": 25, "bones": 12, "boulder": 14, "coin": 10, "ring": 12, "gem": 14, "crown": 4, "mystery": 3},
        "deep":    {"dirt": 20, "rock": 25, "bones": 15, "boulder": 12, "ring": 8, "gem": 14, "crown": 8, "hoard": 2, "mystery": 4},
    },
    "freegame": {
        "topsoil": {"dirt": 50, "rock": 15, "bones": 10, "coin": 25, "ring": 12, "gem": 4},
        "stone":   {"dirt": 25, "rock": 20, "bones": 10, "boulder": 12, "coin": 8, "ring": 14, "gem": 18, "crown": 7, "mystery": 7},
        "deep":    {"dirt": 18, "rock": 22, "bones": 14, "boulder": 10, "ring": 8, "gem": 14, "crown": 9, "hoard": 3, "mystery": 8},
    },
}

# Surface row: each tunnel independently gets a goblin, a Mine Map, or nothing.
# At most one item per tunnel (doc: "at most one per tunnel"). PLACEHOLDER
# "ante" is the base game under Ante Dig: more maps, about 2x the bonus chance.
SURFACE_WEIGHTS = {
    "basegame": {"goblin": 22, "map": 6, "empty": 72},
    "ante":     {"goblin": 22, "map": 8.0, "empty": 70.0},
    "freegame": {"goblin": 44, "map": 4, "empty": 52},
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

# ---- Mystery Ore -------------------------------------------------------
# Every spin picks ONE mystery treasure; every Mystery Ore dug that spin
# becomes it. PLACEHOLDER
MYSTERY_REVEAL = {
    "basegame": {"coin": 30, "ring": 30, "gem": 25, "crown": 12, "hoard": 3},
    "freegame": {"ring": 35, "gem": 40, "crown": 20, "hoard": 5},
}

# ---- Mystery Spin (base game / Ante Dig / Feature Spins only) ------------
# Randomly, the mine rumbles before the drop: every tunnel without a map
# gets a goblin. PLACEHOLDER
MYSTERY_SPIN_CHANCE = 0.02

# ---- Mine Maps -> Free Digs ----------------------------------------------
FREE_SPINS_FOR_MAPS = {3: 8, 4: 10, 5: 12}
# Spins in spins: maps landing during free digs add more digs. PLACEHOLDER
RETRIGGER_SPINS = {2: 1, 3: 3, 4: 4, 5: 5}

# Regular free digs: persistent Mine Multiplier starts at x1 and grows per merge.
FREE_SPIN_START_MULT = 1
FREE_SPIN_MULT_PER_MERGE = 1

# ---- Super Free Digs -----------------------------------------------------
# Bigger start and faster-growing Mine Multiplier. PLACEHOLDER
SUPER_START_MULT = 8
SUPER_MULT_PER_MERGE = 3

# ---- Hidden bonus: Golden Map ---------------------------------------------
# Each Mine Map has this chance to be golden. Not shown in the paytable.
# A trigger that includes a golden map starts Super Free Digs instead.
# 3+ maps with a golden one during regular free digs upgrades to Super mid-bonus.
GOLDEN_MAP_CHANCE = 0.02

# ---- Bet modes for Stake Engine -------------------------------------------
# kind: "spin" = normal paid spin, "buy" = straight into the bonus.
# forced_maps: maps placed on every spin before the rest of the surface lands.
BET_MODES = {
    "base":    {"cost": 1.0,   "sims": 200_000, "kind": "spin", "surface": "basegame"},
    "ante":    {"cost": 1.25,  "sims": 200_000, "kind": "spin", "surface": "ante"},
    "feature": {"cost": 17.0,  "sims": 100_000, "kind": "spin", "surface": "basegame", "forced_maps": 2},
    "bonus":   {"cost": 100.0, "sims": 20_000,  "kind": "buy",  "super": False},
    "super":   {"cost": 450.0, "sims": 20_000,  "kind": "buy",  "super": True},
}
