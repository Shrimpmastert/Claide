# Art and sound slots

Drop files here with these exact names. Anything missing falls back to the built-in
placeholder drawing (or silence), so you can add art one piece at a time and
reload to see it. Images are scaled to fit their slot and keep their aspect ratio.
Use PNG (or WebP renamed to the same path) with transparency for anything that
sits on top of the board.

The board is drawn at 600×760 logical pixels and rendered at up to 2× for retina
screens. The sizes below are 2× and give sharp results.

## Images

| File | Size (px) | What it is |
|---|---|---|
| `symbols/coin.png` | 200×200 | Coin, lowest treasure |
| `symbols/ring.png` | 200×200 | Ring |
| `symbols/gem.png` | 200×200 | Gem |
| `symbols/crown.png` | 200×200 | Crown |
| `symbols/hoard.png` | 200×200 | Hoard Chest, top treasure |
| `symbols/mystery.png` | 200×200 | Mystery Ore "?" block. Also shown faintly through covered dirt |
| `symbols/boulder.png` | 200×200 | Boulder (costs 2 dig power) |
| `symbols/rock.png` | 200×200 | Blank: rock |
| `symbols/bones.png` | 200×200 | Blank: bones |
| `symbols/dirt.png` | 200×200 | Blank: dirt |
| `goblins/goblin.png` | 240×240 | Single goblin with helmet. Dig power number is drawn on top of the helmet |
| `goblins/goblin_2.png` … `goblin_5.png` | 240×240 | Optional bigger merged goblins (2–5). Without them `goblin.png` is scaled up |
| `surface/map.png` | 200×160 | Mine Map scatter |
| `surface/map_golden.png` | 200×160 | Golden Mine Map. Only shown when it triggers or upgrades the bonus |
| `backgrounds/sky_base.png` | 1200×220 | Strip above the mine, base game. Include the grass line at the bottom |
| `backgrounds/sky_free.png` | 1200×220 | Same strip during free digs |
| `backgrounds/sky_super.png` | 1200×220 | Same strip during Super Free Digs |
| `backgrounds/zone_topsoil.png` | 1200×400 | Rock band behind layers 1–2 |
| `backgrounds/zone_stone.png` | 1200×400 | Rock band behind layers 3–4 |
| `backgrounds/zone_deep.png` | 1200×400 | Rock band behind layers 5–6 |
| `cells/cell_covered.png` | 200×168 | Cell that hasn't been dug (semi-transparent lets the zone show through) |
| `cells/cell_open.png` | 200×168 | Dug-out cell behind a revealed symbol |
| `ui/logo.png` | 960×360 | Game logo on the loading screen |
| `ui/favicon.png` | 64×64 | Browser tab icon |
| `ui/page_bg.jpg` | 1920×1080 | Optional page background behind the game |

Layout of the board, in logical pixels: the sky strip is 600×110, each layer is a
120×100 cell (5 tunnels × 6 layers), and cell art is drawn 104×84 inside it.

## Sounds (optional, MP3)

`sounds/drop.mp3`, `dig.mp3`, `collect.mp3`, `boulder.mp3`, `merge.mp3`,
`mystery.mp3`, `map.mp3`, `trigger.mp3`, `super.mp3`, `win.mp3`, `bigwin.mp3`,
`music_base.mp3` (loops), `music_free.mp3` (loops).

To rename or add a slot, edit `web/src/assets.js`.
