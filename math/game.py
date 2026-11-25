"""Goblin Tunnels game logic: one round in, one Stake-style book out."""
import random

import config as C


def cents(x):
    """Stake books store payouts as integer hundredths of the bet."""
    return int(round(x * 100))


def weighted(rng, table):
    keys = list(table)
    return rng.choices(keys, weights=[table[k] for k in keys], k=1)[0]


def bury(rng, game_type):
    """Every cell gets a treasure, blank or boulder. board[tunnel][layer-1]."""
    w = C.SYMBOL_WEIGHTS[game_type]
    return [[weighted(rng, w[C.ZONE_OF_LAYER[layer]]) for layer in range(1, C.LAYERS + 1)]
            for _ in range(C.TUNNELS)]


def drop(rng, game_type, forced_maps=0):
    """Surface row: goblin (with dig power), Mine Map, or empty per tunnel."""
    surface = [None] * C.TUNNELS
    if forced_maps:
        for t in rng.sample(range(C.TUNNELS), forced_maps):
            surface[t] = {"kind": "map"}
    sw = dict(C.SURFACE_WEIGHTS[game_type])
    if forced_maps:
        sw.pop("map")
    for t in range(C.TUNNELS):
        if surface[t] is None:
            kind = weighted(rng, sw)
            surface[t] = {"kind": kind}
            if kind == "goblin":
                surface[t]["power"] = weighted(rng, C.DIG_POWER_WEIGHTS[game_type])
    return surface


def dig(column, depth, power):
    """Dig down from `depth` (0 = surface). Returns new depth, collected, blocked layer."""
    collected, blocked = [], None
    while depth < C.LAYERS:
        sym = column[depth]
        cost = C.BOULDER_COST if sym == C.BOULDER else 1
        if power < cost:
            blocked = depth + 1 if sym == C.BOULDER else None
            break
        power -= cost
        depth += 1
        if sym in C.TREASURE_VALUES:
            collected.append({"layer": depth, "symbol": sym, "value": cents(C.TREASURE_VALUES[sym])})
    return depth, collected, blocked


def play_spin(rng, game_type, events, forced_maps=0, global_mult=None):
    """Bury, drop, dig, merge. Appends events; returns (win_cents, map_count).

    In free spins `global_mult` is a one-item list holding the persistent
    Mine Multiplier, which grows with every merge and multiplies spin wins."""
    board = bury(rng, game_type)
    surface = drop(rng, game_type, forced_maps)
    events.append({"type": "reveal", "gameType": game_type, "board": board, "surface": surface})

    goblins = [None] * C.TUNNELS   # active goblin per tunnel: size, haul, depth
    for t in range(C.TUNNELS):
        if surface[t]["kind"] != "goblin":
            continue
        power = surface[t]["power"]
        depth, got, blocked = dig(board[t], 0, power)
        haul = sum(c["value"] for c in got)
        events.append({"type": "dig", "tunnel": t, "from": 0, "to": depth, "power": power,
                       "collected": got, "blockedBy": blocked, "haul": haul})
        g = {"size": 1, "haul": haul, "depth": depth}
        goblins[t] = g
        # Meet the neighbour on the left at the same depth -> merge and keep digging.
        left = goblins[t - 1] if t > 0 else None
        if left is not None and left["depth"] == g["depth"]:
            g["size"] += left["size"]
            g["haul"] += left["haul"]
            goblins[t - 1] = None
            events.append({"type": "merge", "from": t - 1, "into": t, "depth": g["depth"],
                           "size": g["size"], "multiplier": C.MERGE_MULTIPLIER[g["size"]],
                           "haul": g["haul"], "bonusPower": C.MERGE_BONUS_POWER})
            if global_mult is not None:
                global_mult[0] += C.FREE_SPIN_MULT_PER_MERGE
                events.append({"type": "mineMultiplier", "value": global_mult[0]})
            new_depth, got, blocked = dig(board[t], g["depth"], C.MERGE_BONUS_POWER)
            if new_depth != g["depth"] or got:
                extra = sum(c["value"] for c in got)
                g["haul"] += extra
                events.append({"type": "dig", "tunnel": t, "from": g["depth"], "to": new_depth,
                               "power": C.MERGE_BONUS_POWER, "collected": got,
                               "blockedBy": blocked, "haul": g["haul"]})
                g["depth"] = new_depth

    results, win = [], 0
    for t, g in enumerate(goblins):
        if g is None or g["haul"] == 0:
            continue
        mult = C.MERGE_MULTIPLIER[g["size"]]
        w = g["haul"] * mult
        win += w
        results.append({"tunnel": t, "size": g["size"], "multiplier": mult, "haul": g["haul"], "win": w})
    gm = global_mult[0] if global_mult is not None else 1
    win *= gm
    if results:
        events.append({"type": "spinWin", "gameType": game_type, "goblins": results,
                       "mineMultiplier": gm, "amount": win})
    maps = sum(1 for s in surface if s["kind"] == "map")
    return win, maps


def play_round(rng, book_id, mode):
    """One full round (base spin + any free spins). Returns a Stake book dict."""
    events = []
    cap = cents(C.WIN_CAP)
    forced = 0
    if mode == "bonus":
        forced = weighted(rng, {3: 80, 4: 15, 5: 5})

    base_win, maps = play_spin(rng, "basegame", events, forced)
    total = base_win
    events.append({"type": "setTotalWin", "amount": total})

    free_win = 0
    if maps >= 3:
        spins = C.FREE_SPINS_FOR_MAPS[min(maps, 5)]
        events.append({"type": "freeSpinTrigger", "totalFs": spins,
                       "positions": [i for i, s in enumerate(events[0]["surface"]) if s["kind"] == "map"]})
        i = 0
        mine_mult = [1]
        while i < spins and total < cap:
            i += 1
            events.append({"type": "updateFreeSpin", "amount": i, "total": spins})
            w, m = play_spin(rng, "freegame", events, global_mult=mine_mult)
            free_win += w
            total += w
            events.append({"type": "setTotalWin", "amount": total})
            if m >= 3:
                spins += C.RETRIGGER_SPINS
                events.append({"type": "freeSpinRetrigger", "totalFs": spins})
        events.append({"type": "freeSpinEnd", "amount": free_win})

    capped = total >= cap
    total = min(total, cap)
    events.append({"type": "finalWin", "amount": total, "capped": capped})
    for idx, e in enumerate(events):
        e["index"] = idx
    criteria = "0" if total == 0 else ("freegame" if maps >= 3 else "basegame")
    if capped:
        criteria = "wincap"
    return {"id": book_id, "payoutMultiplier": total, "events": events, "criteria": criteria,
            "baseGameWins": base_win / 100, "freeGameWins": free_win / 100}
