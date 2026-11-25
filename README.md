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

Static HTML/JS with no build step and only relative paths. Without launch params it
runs in demo mode on the sample rounds in `web/books/`. Launched by Stake Engine
(`?sessionID=…&rgs_url=…&lang=…&device=…`) it uses the RGS wallet API
(`/wallet/authenticate`, `/wallet/play`, `/wallet/end-round`, `/bet/event`) and plays
back `round.state`.

What it handles:
- **Bets:** bet levels from the RGS config, filtered to `minBet`/`maxBet`/`stepBet`.
- **Currency:** formatting for ISO and crypto codes, and the social coins `XGC`/`XSC` (shown as GC/SC).
- **Social casino:** when `jurisdiction.socialCasino` is set, no "bet" or "buy" wording.
- **Jurisdiction:** turbo is hidden when `jurisdiction.disabledTurbo` is set.
- **Errors:** player-facing messages for each RGS error code.
- **Resume:** replays an active round after a reconnect.
- **Buys:** confirmation dialog before buying a bonus.
- **Screens:** rules/paytable built from `web/data/paytable.json`, including RTP per mode and max win; loading screen with progress.
- **Sound:** mute toggle.
- **Text:** all wording lives in `web/src/text.js`, ready for translations.

### Adding art

See **`web/assets/README.md`** for every image and sound slot, with file names and
sizes. Drop files into `web/assets/` and reload. Missing files fall back to the
built-in placeholders, so you can add art one piece at a time.

## Publishing

```bash
python math/run.py     # only if you changed math/config.py (~2 min)
python build.py        # validates everything, writes dist/
```

`build.py` checks every book against its lookup table, the final win against the
payout, the max win cap, uint64 weights and RTP per mode. It lists any art slots still
on placeholders and fails on errors. Then:

1. Stake Engine dashboard → your game → **Files**: upload the contents of
   `dist/math/` (5 books files, 5 lookup tables, `index.json`), then
   **Publish → Math**.
2. Upload the contents of `dist/frontend/` (`index.html` at the root), then
   **Publish → Front End**.
3. Developer page → **Start game session → Launch in New Tab** to test on the real RGS.

### Still to check before submitting

- **Stake's approval checklist:** I couldn't reach Stake's documentation site from the
  build environment. The file formats and RGS calls match the public engineio
  `math-sdk`/`web-sdk` docs, but read Stake's current approval checklist for any
  rules on mode count, ante/feature/bonus buys per jurisdiction, and required rules wording.
- **Resume:** it reads the saved position from `round.event` (sent with
  `/bet/event` each free dig). Confirm that field name on a real disconnect.
- **Mode name case:** mode names are sent lowercase, matching `index.json`. The RGS docs
  example shows `"BASE"`, so check that a play goes through on the real RGS.
- **Placeholder numbers:** the values marked PLACEHOLDER in `math/config.py` are the design numbers I filled in.
