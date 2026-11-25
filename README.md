# Goblin Tunnels (Stake Engine)

Dig-and-collect slot. Goblins drop into five mine tunnels, dig down and collect the
treasure they pass. Goblins that meet underground merge into bigger goblins with
bigger multipliers.

```
math/   Python math model -> Stake Engine books + lookup tables
web/    Static front end (no build step) that plays back book events
```

## Math

```bash
pip install zstandard
cd math
python tune.py 10000     # quick raw RTP / hit rate / win distribution while tuning
python run.py            # full sims, weight fitting, export
```

`run.py` writes to `library/publish_files/` in the Stake Engine layout:

- `index.json`: the five bet modes and their costs
- `books_<mode>.jsonl.zst`: one book per line, `{id, payoutMultiplier, events, ...}`
- `lookUpTable_<mode>_0.csv`: `id,weight,payoutMultiplier`

Payouts are integer hundredths of the bet (`250` = 2.5x). The simulation's raw RTP is
pulled onto `TARGET_RTP` by an exponential tilt on the lookup-table weights, so keep the
raw RTP within a few percent of target (check with `tune.py`). Run stats go to
`library/stats.json`. It also writes sample books per mode plus `modes.json` to `web/books/` for the demo.

Every number is in `math/config.py`. The values marked PLACEHOLDER were not in the
design doc and were filled in so the model runs end to end.

### Rules as implemented

1. **Bury.** 5 tunnels × 6 layers. Each cell gets a treasure, blank (dirt, rock,
   bones) or boulder, drawn from its zone's weights (topsoil 1–2, stone 3–4,
   deep vein 5–6).
2. **Drop.** Each surface slot gets a goblin with dig power 1–6, a Mine Map, or nothing.
3. **Dig.** Goblins dig left to right, one layer per power point. A boulder costs
   2 power. If the goblin can't afford it, the boulder stops it.
4. **Merge.** If a goblin stops at the same depth as the goblin in the tunnel to its
   left, they merge: hauls pool, size grows, multiplier becomes
   `MERGE_MULTIPLIER[size]` (x1, x2, x5, x10, x25), and the merged goblin gets +1 dig
   power. Merges can chain left to right across all five tunnels.
5. **Pay.** Each goblin pays its haul × multiplier.
6. **Mystery Ore.** Purple "?" blocks glow through the dirt. Each spin picks one hidden
   treasure, and every Mystery Ore dug that spin turns into it.
7. **Mystery Spin.** 2% of paid spins: the mine rumbles and every tunnel without a
   map gets a goblin.
8. **Free Digs.** 3/4/5 Mine Maps give 8/10/12 free digs. Free digs use richer tables
   and a Mine Multiplier that starts at x1, grows +1 per merge and lasts the whole bonus.
   **Spins in spins:** 2 maps during free digs add +1, 3/4/5 add +3/+4/+5.
9. **Super Free Digs.** Mine Multiplier starts at x8 and grows +3 per merge.
10. **Hidden bonus: Golden Map.** Each map has a 2% chance to be golden. It isn't shown
    as golden unless it matters. A trigger with a golden map starts Super Free Digs
    instead of regular ones, including a regular bonus buy. 3+ maps with a golden one
    during regular free digs upgrade the bonus to Super mid-round.
11. Max win 10000x the bet in every mode.

### Bet modes

| Mode | Cost | What it does | Bonus chance |
|---|---|---|---|
| `base` | 1x | Normal spin | 1 in ~520 |
| `ante` | 1.25x | Ante Dig: more Mine Maps land | 1 in ~235 |
| `feature` | 17x | Feature Spins: 2 Mine Maps placed every spin | 1 in ~6 |
| `bonus` | 100x | Buy Free Digs (3–5 maps; a golden map still upgrades it) | always |
| `super` | 450x | Buy Super Free Digs | always |

All five modes are fitted to 96.5% RTP. About 5–7% of bonuses become Super through the Golden Map.

### Book events

`reveal` (board, surface, `mysterySpin`), `dig`, `mysteryReveal`, `merge`,
`mineMultiplier`, `spinWin`, `setTotalWin`, `freeSpinTrigger` (`super`),
`updateFreeSpin`, `freeSpinRetrigger` (`added`), `superUpgrade`, `freeSpinEnd`, `finalWin`. All amounts are hundredths of the bet.

## Front end

```bash
cd web && python3 -m http.server 8000   # open http://localhost:8000
```

Without launch params it runs in demo mode on the sample books. Launched by Stake
Engine (`?sessionID=…&rgs_url=…&lang=…&currency=…`) it uses the RGS wallet API
(`/wallet/authenticate`, `/wallet/play`, `/wallet/end-round`) and plays back
`round.state`.

## Before submitting to Stake

- Check the file formats and RGS calls against the current Stake Engine docs.
  They were written from memory of the `math-sdk` / `web-sdk` conventions.
- Replace the placeholder values with the real design numbers and re-run.
- Stake's own optimizer (in `math-sdk`) gives finer control over the win
  distribution than the single-parameter tilt used here.
- Add art, sound, a paytable/rules screen and localisation. The canvas drawings are placeholders.
