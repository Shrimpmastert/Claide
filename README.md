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

- `index.json`: bet modes (`base` cost 1, `bonus` cost 100)
- `books_<mode>.jsonl.zst`: one book per line, `{id, payoutMultiplier, events, ...}`
- `lookUpTable_<mode>_0.csv`: `id,weight,payoutMultiplier`

Payouts are integer hundredths of the bet (`250` = 2.5x). The simulation's raw RTP is
pulled onto `TARGET_RTP` by an exponential tilt on the lookup-table weights, so keep the
raw RTP within a few percent of target (check with `tune.py`). Run stats go to
`library/stats.json`. It also writes sample books (300 base, 60 bonus, plus the 5 biggest wins) to `web/books/` for the demo.

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
6. **Mine Maps.** 3/4/5 maps give 8/10/12 free digs. Free digs use richer
   tables and a persistent Mine Multiplier that grows +1 per merge. 3+ maps retrigger +5.
   Bonus buy costs 100x and guarantees 3–5 maps. Max win 5000x.

### Book events

`reveal` (board + surface), `dig`, `merge`, `mineMultiplier`, `spinWin`,
`setTotalWin`, `freeSpinTrigger`, `updateFreeSpin`, `freeSpinRetrigger`,
`freeSpinEnd`, `finalWin`. All amounts are hundredths of the bet.

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
