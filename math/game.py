"""Goblin Tunnels game logic: one round in, one Stake-style book out."""
import config as C


def cents(x):
    """Stake books store payouts as integer hundredths of the bet."""
    return int(round(x * 100))


def weighted(rng, table):
    keys = list(table)
    return rng.choices(keys, weights=[table[k] for k in keys], k=1)[0]


def bury(rng, game_type):
    """Every cell gets a treasure, blank, boulder or Mystery Ore. board[tunnel][layer-1]."""
    w = C.SYMBOL_WEIGHTS[game_type]
    return [[weighted(rng, w[C.ZONE_OF_LAYER[layer]]) for layer in range(1, C.LAYERS + 1)]
            for _ in range(C.TUNNELS)]


def new_map(rng):
    return {"kind": "map", "golden": rng.random() < C.GOLDEN_MAP_CHANCE}


def drop(rng, surface_key, power_key, forced_maps=0, mystery_spin=False):
    """Surface row: goblin (with dig power), Mine Map, or empty per tunnel."""
    surface = [None] * C.TUNNELS
    for t in rng.sample(range(C.TUNNELS), forced_maps):
        surface[t] = new_map(rng)
    sw = C.SURFACE_WEIGHTS[surface_key]
    for t in range(C.TUNNELS):
        if surface[t] is not None:
            continue
        kind = weighted(rng, sw)
        if kind == "map":
            surface[t] = new_map(rng)
        else:
            surface[t] = {"kind": kind}
    if mystery_spin:  # every tunnel without a map gets a goblin
        for t in range(C.TUNNELS):
            if surface[t]["kind"] != "map":
                surface[t] = {"kind": "goblin"}
    for s in surface:
        if s["kind"] == "goblin":
            s["power"] = weighted(rng, C.DIG_POWER_WEIGHTS[power_key])
    return surface


def dig(column, depth, power, mystery_symbol):
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
        if sym == C.MYSTERY:
            collected.append({"layer": depth, "symbol": mystery_symbol, "mystery": True,
                              "value": cents(C.TREASURE_VALUES[mystery_symbol])})
        elif sym in C.TREASURE_VALUES:
            collected.append({"layer": depth, "symbol": sym, "value": cents(C.TREASURE_VALUES[sym])})
    return depth, collected, blocked


def play_spin(rng, game_type, events, surface_key=None, forced_maps=0, mine=None):
    """Bury, drop, dig, merge. Appends events; returns (win_cents, surface).

    `mine` is the free-dig state dict (Mine Multiplier etc.); None in the base game."""
    board = bury(rng, game_type)
    mystery_symbol = weighted(rng, C.MYSTERY_REVEAL[game_type])
    mystery_spin = game_type == "basegame" and rng.random() < C.MYSTERY_SPIN_CHANCE
    surface = drop(rng, surface_key or game_type, game_type, forced_maps, mystery_spin)
    events.append({"type": "reveal", "gameType": game_type, "board": board, "surface": surface,
                   "mysterySpin": mystery_spin})

    goblins = [None] * C.TUNNELS   # active goblin per tunnel: size, haul, depth
    mystery_shown = False

    def do_dig(t, start, power):
        nonlocal mystery_shown
        depth, got, blocked = dig(board[t], start, power, mystery_symbol)
        if not mystery_shown and any(c.get("mystery") for c in got):
            mystery_shown = True
            events.append({"type": "mysteryReveal", "symbol": mystery_symbol})
        return depth, got, blocked

    for t in range(C.TUNNELS):
        if surface[t]["kind"] != "goblin":
            continue
        power = surface[t]["power"]
        depth, got, blocked = do_dig(t, 0, power)
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
            if mine is not None:
                mine["mult"] += mine["per_merge"]
                events.append({"type": "mineMultiplier", "value": mine["mult"]})
            new_depth, got, blocked = do_dig(t, g["depth"], C.MERGE_BONUS_POWER)
            if new_depth != g["depth"] or got:
                g["haul"] += sum(c["value"] for c in got)
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
    gm = mine["mult"] if mine is not None else 1
    win *= gm
    if results:
        events.append({"type": "spinWin", "gameType": game_type, "goblins": results,
                       "mineMultiplier": gm, "amount": win})
    return win, surface


def map_info(surface):
    maps = [i for i, s in enumerate(surface) if s["kind"] == "map"]
    golden = [i for i in maps if surface[i].get("golden")]
    return maps, golden


def free_digs(rng, events, spins, positions, super_mode, total, cap):
    """Regular or Super Free Digs. Returns (free_win, upgraded_to_super)."""
    mine = {"mult": C.SUPER_START_MULT if super_mode else C.FREE_SPIN_START_MULT,
            "per_merge": C.SUPER_MULT_PER_MERGE if super_mode else C.FREE_SPIN_MULT_PER_MERGE}
    events.append({"type": "freeSpinTrigger", "totalFs": spins, "positions": positions,
                   "super": super_mode, "mineMultiplier": mine["mult"]})
    free_win, i = 0, 0
    while i < spins and total + free_win < cap:
        i += 1
        events.append({"type": "updateFreeSpin", "amount": i, "total": spins})
        w, surface = play_spin(rng, "freegame", events, mine=mine)
        free_win += w
        events.append({"type": "setTotalWin", "amount": total + free_win})
        maps, golden = map_info(surface)
        if len(maps) >= 2:  # spins in spins
            added = C.RETRIGGER_SPINS[min(len(maps), 5)]
            spins += added
            events.append({"type": "freeSpinRetrigger", "added": added, "totalFs": spins})
        if golden and len(maps) >= 3 and not super_mode:  # hidden upgrade mid-bonus
            super_mode = True
            mine["mult"] = max(mine["mult"], C.SUPER_START_MULT)
            mine["per_merge"] = C.SUPER_MULT_PER_MERGE
            events.append({"type": "superUpgrade", "mineMultiplier": mine["mult"]})
    events.append({"type": "freeSpinEnd", "amount": free_win, "super": super_mode})
    return free_win, super_mode


def play_round(rng, book_id, mode):
    """One full round (base spin + any free digs). Returns a Stake book dict."""
    spec = C.BET_MODES[mode]
    events = []
    cap = cents(C.WIN_CAP)

    if spec["kind"] == "buy":
        forced = weighted(rng, {3: 80, 4: 15, 5: 5})
        base_win, surface = play_spin(rng, "basegame", events, forced_maps=forced)
    else:
        base_win, surface = play_spin(rng, "basegame", events, surface_key=spec["surface"],
                                      forced_maps=spec.get("forced_maps", 0))
    total = base_win
    events.append({"type": "setTotalWin", "amount": total})

    maps, golden = map_info(surface)
    free_win, went_super = 0, False
    if len(maps) >= 3:
        super_mode = spec.get("super", False) or bool(golden)
        free_win, went_super = free_digs(rng, events, C.FREE_SPINS_FOR_MAPS[min(len(maps), 5)],
                                         maps, super_mode, total, cap)
        total += free_win

    capped = total >= cap
    total = min(total, cap)
    events.append({"type": "finalWin", "amount": total, "capped": capped})
    for idx, e in enumerate(events):
        e["index"] = idx
    if capped:
        criteria = "wincap"
    elif len(maps) >= 3:
        criteria = "superfreegame" if went_super else "freegame"
    else:
        criteria = "0" if total == 0 else "basegame"
    return {"id": book_id, "payoutMultiplier": total, "events": events, "criteria": criteria,
            "baseGameWins": base_win / 100, "freeGameWins": free_win / 100}
