// Goblin Tunnels front end: draws the mine and plays back book events.
import { createClient, eventsOf, API_MULT, launch } from './rgs.js';
import { t, setLanguage, setCurrency, formatMoney } from './text.js';
import { loadAll, drawImg, fillImg, img, IMAGES, play as sfx, playMusic, setMuted, isMuted } from './assets.js';

const TUNNELS = 5, LAYERS = 6;
const W = 600, H = 760, TOP = 110, ROW = 100, COLW = W / TUNNELS;
const ZONES = [
  { from: 1, to: 2, name: 'TOPSOIL', color: '#5b3a22', img: 'zone_topsoil' },
  { from: 3, to: 4, name: 'STONE', color: '#4a4440', img: 'zone_stone' },
  { from: 5, to: 6, name: 'DEEP VEIN', color: '#2d2438', img: 'zone_deep' },
];

const $ = id => document.getElementById(id);
const canvas = $('board');
let ctx = canvas.getContext('2d');

const state = {
  board: null,            // [tunnel][layer-1] symbol
  dug: [],                // [tunnel] deepest dug layer
  surface: Array(TUNNELS).fill({ kind: 'empty' }),
  goblins: [],            // {tunnel, x, y, size, power, haul, mult, alpha}
  popups: [],             // floating text
  mineMult: 1,
  freeSpins: null,        // {i, n}
};

// ---------- drawing ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function cellCenter(t, layer) { return [t * COLW + COLW / 2, TOP + (layer - 0.5) * ROW]; }

function drawSymbol(sym, x, y, s = 1) {
  if (drawImg(ctx, sym, x, y, 76 * s, 76 * s)) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  switch (sym) {
    case 'coin':
      circle(0, 0, 16, '#f2b632'); circle(0, 0, 11, '#ffd766'); label('¢', 0, 1, '#8a5a00', 14); break;
    case 'ring':
      ctx.lineWidth = 6; ctx.strokeStyle = '#e8c45a'; ctx.beginPath(); ctx.arc(0, 4, 13, 0, Math.PI * 2); ctx.stroke();
      poly([[0, -18], [7, -10], [0, -4], [-7, -10]], '#ff5fa2'); break;
    case 'gem':
      poly([[0, -20], [18, -4], [0, 20], [-18, -4]], '#36d4e6'); poly([[0, -20], [8, -4], [0, 20], [-8, -4]], '#9ff3fb'); break;
    case 'crown':
      poly([[-20, 14], [-20, -10], [-10, 2], [0, -16], [10, 2], [20, -10], [20, 14]], '#f2b632');
      circle(0, 6, 4, '#e0334a'); break;
    case 'hoard':
      rect(-22, -10, 44, 26, '#8a4b1c'); rect(-22, -18, 44, 10, '#a85d24'); rect(-22, -4, 44, 4, '#f2b632');
      rect(-4, -6, 8, 10, '#f2b632'); circle(-12, -20, 5, '#ffd766'); circle(10, -21, 5, '#ffd766'); break;
    case 'boulder':
      circle(0, 2, 22, '#7d7873'); circle(-6, -4, 7, '#948f89'); break;
    case 'rock': poly([[-12, 8], [-6, -8], [8, -6], [12, 8]], '#6d6661'); break;
    case 'bones':
      ctx.strokeStyle = '#e8dfcf'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      line(-12, -8, 12, 8); line(-12, 8, 12, -8); break;
    case 'dirt': circle(-6, 4, 4, '#7a5234'); circle(6, -3, 3, '#7a5234'); break;
    case 'mystery':
      poly([[-20, -8], [-8, -22], [14, -18], [22, 2], [10, 20], [-14, 18]], '#5a2d82');
      poly([[-12, -6], [-4, -16], [10, -12], [14, 0], [6, 12], [-8, 10]], '#9b59d0');
      label('?', 1, 0, '#fff3a8', 22); break;
  }
  ctx.restore();
}
const circle = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
const line = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); };
const poly = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
const label = (txt, x, y, c, size = 16, weight = 800) => {
  ctx.fillStyle = c; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y);
};

function drawGoblin(g) {
  const r = 22 + (g.size - 1) * 5;
  ctx.save(); ctx.globalAlpha = g.alpha ?? 1; ctx.translate(g.x, g.y);
  const art = g.size > 1 && drawImg(ctx, `goblin_${g.size}`, 0, 0, 2.6 * r, 2.6 * r) || drawImg(ctx, 'goblin', 0, 0, 2.6 * r, 2.6 * r);
  if (art) {
    if (g.power != null) { circle(0, -r - 4, 12, '#e6a21c'); label(String(g.power), 0, -r - 4, '#3a2400', 14); }
    if (g.size > 1) { circle(r - 2, r - 2, 13, '#e0334a'); label(`x${g.mult}`, r - 2, r - 2, '#fff', 12); }
    ctx.restore(); return;
  }
  circle(0, 4, r, '#5fbf4a');                               // head
  poly([[-r, -2], [-r - 12, -10], [-r + 4, 8]], '#4ea33b');  // ears
  poly([[r, -2], [r + 12, -10], [r - 4, 8]], '#4ea33b');
  circle(-8, 4, 4, '#1b1b1b'); circle(8, 4, 4, '#1b1b1b');
  ctx.fillStyle = '#e6a21c'; ctx.beginPath(); ctx.arc(0, -2, r, Math.PI, 0); ctx.fill();  // helmet
  circle(0, -r + 4, 6, '#fff7c2');                                                     // lamp
  if (g.power != null) label(String(g.power), 0, -10, '#3a2400', 15);
  if (g.size > 1) { circle(r - 2, r - 2, 13, '#e0334a'); label(`x${g.mult}`, r - 2, r - 2, '#fff', 12); }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // sky / surface
  if (!fillImg(ctx, state.super ? 'sky_super' : state.freeSpins ? 'sky_free' : 'sky_base', 0, 0, W, TOP)) {
    const sky = ctx.createLinearGradient(0, 0, 0, TOP);
    sky.addColorStop(0, state.super ? '#6b4a00' : state.freeSpins ? '#3b1f5c' : '#2a3a52'); sky.addColorStop(1, '#6b4a2a');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, TOP);
    rect(0, TOP - 8, W, 8, '#3f7a2c');
  }
  // zones
  for (const z of ZONES) {
    if (!fillImg(ctx, z.img, 0, TOP + (z.from - 1) * ROW, W, (z.to - z.from + 1) * ROW))
      rect(0, TOP + (z.from - 1) * ROW, W, (z.to - z.from + 1) * ROW, z.color);
    ctx.save(); ctx.globalAlpha = 0.35; label(z.name, W - 44, TOP + (z.from - 1) * ROW + 12, '#fff', 10, 700); ctx.restore();
  }
  // tunnels & cells
  for (let t = 0; t < TUNNELS; t++) {
    const x = t * COLW;
    if (t) { rect(x - 1, TOP, 2, LAYERS * ROW, 'rgba(0,0,0,.35)'); }
    for (let l = 1; l <= LAYERS; l++) {
      const [cx, cy] = cellCenter(t, l);
      const open = state.dug[t] >= l;
      if (open) {
        if (!fillImg(ctx, 'cell_open', x + 8, cy - ROW / 2 + 8, COLW - 16, ROW - 16)) { ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(x + 8, cy - ROW / 2 + 8, COLW - 16, ROW - 16, 12); }
        const sym = state.board?.[t][l - 1];
        if (sym && !state.collected?.has(`${t}:${l}`)) drawSymbol(sym === 'mystery' && state.mystery ? state.mystery : sym, cx, cy);
      } else {
        if (!fillImg(ctx, 'cell_covered', x + 8, cy - ROW / 2 + 8, COLW - 16, ROW - 16)) { ctx.fillStyle = 'rgba(255,255,255,.04)'; roundRect(x + 8, cy - ROW / 2 + 8, COLW - 16, ROW - 16, 12); }
        if (state.board?.[t][l - 1] === 'mystery') { ctx.save(); ctx.globalAlpha = .55; drawSymbol('mystery', cx, cy, .8); ctx.restore(); }
      }
    }
    // surface item
    const s = state.surface[t];
    if (s.kind === 'map' && !state.goblins.some(g => g.tunnel === t && g.y > TOP)) {
      const [mx] = cellCenter(t, 0);
      const gold = s.golden && state.goldShown;
      if (drawImg(ctx, gold ? 'map_golden' : 'map', mx, TOP - 46, 64, 52)) continue;
      if (gold) { ctx.save(); ctx.shadowColor = '#ffd766'; ctx.shadowBlur = 24; rect(mx - 26, TOP - 62, 52, 40, '#ffd766'); ctx.restore(); }
      rect(mx - 26, TOP - 62, 52, 40, gold ? '#f2c94c' : '#e9d5a1'); ctx.strokeStyle = gold ? '#fff7c2' : '#8a5a2b'; ctx.lineWidth = 2; ctx.strokeRect(mx - 26, TOP - 62, 52, 40);
      label('✕', mx + 8, TOP - 44, '#c0392b', 18); ctx.setLineDash([3, 3]); line(mx - 18, TOP - 30, mx + 4, TOP - 44); ctx.setLineDash([]);
      label(gold ? 'GOLDEN' : 'MAP', mx, TOP - 12, gold ? '#ffd766' : '#e9d5a1', 10);
    }
  }
  for (const g of state.goblins) drawGoblin(g);
  for (const p of state.popups) { ctx.save(); ctx.globalAlpha = p.a; label(p.text, p.x, p.y, p.color || '#ffd766', p.size || 18); ctx.restore(); }
  // free spin HUD
  if (state.freeSpins) {
    const hud = t(state.super ? 'hudSuper' : 'hudFree', state.freeSpins);
    label(hud, 16 + hud.length * 4.3, 20, state.super ? '#ffd766' : '#e7c9ff', 15);
    label(t('hudMine', { mult: state.mineMult }), W - 70, 20, '#ffd766', 16);
  }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); }

// ---------- animation helpers ----------
let speed = 1;
function loop() { draw(); requestAnimationFrame(loop); }
const wait = ms => new Promise(r => setTimeout(r, ms / speed));
function tween(obj, to, ms) {
  const from = Object.fromEntries(Object.keys(to).map(k => [k, obj[k]]));
  const dur = ms / speed, start = performance.now();
  return new Promise(res => {
    const step = now => {
      const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
      for (const key in to) obj[key] = from[key] + (to[key] - from[key]) * e;
      k < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}
function popup(text, x, y, color, size) {
  const p = { text, x, y, a: 1, color, size }; state.popups.push(p);
  tween(p, { y: y - 40, a: 0 }, 900).then(() => state.popups.splice(state.popups.indexOf(p), 1));
}

// ---------- event playback ----------
let bet = 1;                                        // base bet in display units
const money = cents => formatMoney(cents / 100 * bet);   // book amounts are x100 of the bet
let roundWin = 0;
let roundIndex = 0;                                 // index of the event being played

async function play(events, startAt = 0) {
  roundWin = 0; setWin(0); state.mineMult = 1; state.freeSpins = null; state.super = false; banner();
  // On resume, fast-forward everything before the saved point.
  const saved = speed;
  for (const e of events) {
    roundIndex = e.index ?? 0;
    speed = roundIndex < startAt ? 50 : saved;
    const fn = handlers[e.type];
    if (fn) await fn(e);
  }
  speed = saved;
  state.freeSpins = null; state.super = false;
  playMusic('music_base');
}

const goblinAt = tn => state.goblins.find(g => g.tunnel === tn);

const handlers = {
  async reveal(e) {
    state.board = e.board; state.surface = e.surface; state.dug = Array(TUNNELS).fill(0);
    state.collected = new Set(); state.goblins = []; state.mystery = null; state.goldShown = false;
    if (e.mysterySpin) { sfx('mystery'); await banner(t('mysterySpin'), 1300); }
    const drops = [];
    e.surface.forEach((s, tn) => {
      if (s.kind !== 'goblin') return;
      const [x] = cellCenter(tn, 0);
      const g = { tunnel: tn, x, y: -40, size: 1, mult: 1, power: s.power, haul: 0 };
      state.goblins.push(g);
      drops.push(wait(tn * 90).then(() => { sfx('drop', 0.6); return tween(g, { y: TOP - 34 }, 380); }));
    });
    await Promise.all(drops);
    const maps = e.surface.filter(s => s.kind === 'map').length;
    if (maps >= 3 && e.surface.some(s => s.golden)) state.goldShown = true;
    if (maps) { sfx('map'); setStatus(t('maps', { n: maps })); }
    await wait(250);
  },
  async dig(e) {
    const g = goblinAt(e.tunnel); if (!g) return;
    const values = new Map(e.collected.map(c => [c.layer, c.value]));
    for (let l = e.from + 1; l <= e.to; l++) {
      state.dug[e.tunnel] = l;
      const [, cy] = cellCenter(e.tunnel, l);
      const isBoulder = state.board[e.tunnel][l - 1] === 'boulder';
      g.power = Math.max(0, (g.power ?? 0) - (isBoulder ? 2 : 1));
      sfx(isBoulder ? 'boulder' : 'dig', 0.5);
      await tween(g, { y: cy }, 260);
      if (values.has(l)) {
        state.collected.add(`${e.tunnel}:${l}`);
        g.haul += values.get(l);
        sfx('collect', 0.7);
        popup(`+${money(values.get(l))}`, g.x, cy - 30);
        await wait(140);
      }
    }
    if (e.blockedBy) popup(t('boulder'), g.x, cellCenter(e.tunnel, e.blockedBy)[1], '#cfcfcf', 14);
    g.power = null;
    await wait(120);
  },
  async mysteryReveal(e) {
    state.mystery = e.symbol; sfx('mystery');
    await banner(t('mysteryOre', { symbol: e.symbol.toUpperCase() }), 900);
  },
  async merge(e) {
    const a = goblinAt(e.from), b = goblinAt(e.into); if (!a || !b) return;
    sfx('merge');
    await tween(a, { x: b.x, alpha: 0.3 }, 320);
    state.goblins.splice(state.goblins.indexOf(a), 1);
    b.size = e.size; b.mult = e.multiplier; b.haul = e.haul; b.power = e.bonusPower;
    popup(t('merge', { mult: e.multiplier }), b.x, b.y - 40, '#ff7a8a', 20);
    await wait(380);
  },
  async mineMultiplier(e) { state.mineMult = e.value; popup(t('hudMine', { mult: e.value }), W - 70, 40, '#ffd766', 18); await wait(200); },
  async superUpgrade(e) {
    state.super = true; state.mineMult = e.mineMultiplier; sfx('super');
    await banner(t('goldenUpgrade', { mult: e.mineMultiplier }), 1800);
  },
  async spinWin(e) {
    sfx('win', 0.8);
    for (const r of e.goblins) {
      const g = goblinAt(r.tunnel);
      if (g) popup(money(r.win), g.x, g.y + 34, '#7dff6a', 20);
    }
    if (e.mineMultiplier > 1) popup(`x${e.mineMultiplier}`, W / 2, H / 2, '#ffd766', 32);
    await wait(650);
  },
  async setTotalWin(e) { roundWin = e.amount; setWin(roundWin); },
  async freeSpinTrigger(e) {
    state.freeSpins = { i: 0, n: e.totalFs }; state.super = !!e.super; state.mineMult = e.mineMultiplier ?? 1;
    sfx(e.super ? 'super' : 'trigger');
    if (e.super && state.goldShown) await banner(t('goldenFound'), 1200);
    await banner(e.super ? t('superDigs', { n: e.totalFs, mult: state.mineMult }) : t('freeDigs', { n: e.totalFs }), 1600);
    playMusic('music_free');
  },
  async freeSpinRetrigger(e) {
    state.freeSpins.n = e.totalFs; sfx('trigger', 0.6);
    await banner(e.added === 1 ? t('moreDig') : t('moreDigs', { n: e.added }), 1000);
  },
  async updateFreeSpin(e) { state.freeSpins = { i: e.amount, n: e.total }; client.event(e.index); },
  async freeSpinEnd(e) { await banner(t(e.super ? 'superDigsWon' : 'freeDigsWon', { amount: money(e.amount) }), 1600); },
  async finalWin(e) {
    roundWin = e.amount; setWin(roundWin);
    const x = e.amount / 100;
    if (e.capped) { sfx('bigwin'); await banner(t('maxWin', { amount: money(e.amount) }), 2200); }
    else if (x >= 20) { sfx('bigwin'); await banner(t(x >= 100 ? 'megaWin' : 'bigWin', { amount: money(e.amount) }), 1800); }
  },
};

async function banner(text, ms) {
  const el = $('banner');
  if (!text) { el.hidden = true; return; }
  el.textContent = text; el.hidden = false;
  await wait(ms); el.hidden = true;
}

// ---------- UI / round flow ----------
const client = createClient();
let betLevels = [API_MULT], betIndex = 0, busy = false;
let modes = { base: { cost: 1 }, ante: { cost: 1.25 }, feature: { cost: 17 }, bonus: { cost: 100 }, super: { cost: 450 } };
let paytable = null;
let spinMode = 'base';   // base | ante | feature

const micro = v => formatMoney(v / API_MULT);
function setWin(cents) { $('win').textContent = money(cents); }
function setStatus(s) { $('status').textContent = s || ''; }
function setBalance(b) { $('balance').textContent = micro(b.amount); }
function setBet() {
  bet = betLevels[betIndex] / API_MULT;
  const c = m => formatMoney(bet * (modes[m]?.cost ?? 1));
  $('bet').textContent = formatMoney(bet);
  $('spinCost').textContent = c(spinMode);
  $('buyCost').textContent = c('bonus');
  $('superCost').textContent = c('super');
  $('anteSub').textContent = t('anteSub', { cost: modes.ante?.cost });
  $('featureSub').textContent = t('featureSub', { cost: modes.feature?.cost });
}
function setSpinMode(m) {
  spinMode = spinMode === m ? 'base' : m;
  $('ante').setAttribute('aria-pressed', spinMode === 'ante');
  $('feature').setAttribute('aria-pressed', spinMode === 'feature');
  setBet();
}
function lock(on) { busy = on; for (const id of ['spin', 'buy', 'buySuper', 'ante', 'feature', 'betUp', 'betDown']) $(id).disabled = on; }
function showError(err) { setStatus(t(`errors.${err.code}`) !== `errors.${err.code}` ? t(`errors.${err.code}`) : t('errors.ERR_GEN')); }

async function round(mode) {
  if (busy) return;
  lock(true); setStatus('');
  try {
    const res = await client.play(betLevels[betIndex], mode);
    setBalance(res.balance);
    await play(res.events);
    // Rounds with a payout stay active until end-round credits them.
    if (res.round?.active) setBalance((await client.endRound()).balance);
  } catch (err) {
    showError(err);
  } finally { lock(false); }
}

function confirmBuy(mode) {
  if (busy) return;
  const name = t(mode === 'super' ? 'buySuper' : 'buyBonus');
  $('confirmText').textContent = t('confirmBuy', { name, amount: formatMoney(bet * modes[mode].cost) });
  const dlg = $('confirm');
  dlg.returnValue = '';
  dlg.onclose = () => { if (dlg.returnValue === 'ok') round(mode); };
  dlg.showModal();
}

function buildRules() {
  if (!paytable) return;
  const p = paytable, pct = r => `${(r * 100).toFixed(2)}%`;
  const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  const modeName = { base: t('dig'), ante: t('ante'), feature: t('feature'), bonus: t('buyBonus'), super: t('buySuper') };
  $('rulesBody').innerHTML = `
    <h3>How it plays</h3>
    <p>Goblins drop onto the surface of up to ${p.tunnels} tunnels. Each wears a helmet showing its dig power (1–6).
    Goblins dig left to right, one layer per power point, collecting every treasure they pass. A boulder costs ${p.boulderCost} power;
    a goblin that can't break it stops.</p>
    <h3>Treasure values (x ${t('stake')})</h3>
    <table>${Object.entries(p.treasures).map(([k, v]) => row(`<canvas class="sym" data-sym="${k}" width="64" height="64"></canvas> ${k}`, `${v}x`)).join('')}</table>
    <h3>Merging</h3>
    <p>When a goblin stops at the same depth as the goblin in the tunnel to its left, they merge: their hauls pool,
    the goblin grows and digs ${p.mergeBonusPower} more layer. Each goblin pays its haul × its size multiplier.</p>
    <table>${Object.entries(p.mergeMultiplier).map(([k, v]) => row(`${k} goblin${k > 1 ? 's' : ''}`, `x${v}`)).join('')}</table>
    <h3>Mystery Ore</h3><p>Every Mystery Ore dug in a spin turns into the same randomly chosen treasure.</p>
    <h3>Mystery Spin</h3><p>At random the mine rumbles and every tunnel without a Mine Map gets a goblin.</p>
    <h3>Free Digs</h3>
    <p>${Object.entries(p.freeSpins).map(([k, v]) => `${k} Mine Maps award ${v} free digs`).join(', ')}.
    During free digs a Mine Multiplier starts at x${p.freeMult.start} and grows by ${p.freeMult.perMerge} with every merge.
    It multiplies every free dig win. Mine Maps during free digs award more:
    ${Object.entries(p.retrigger).map(([k, v]) => `${k} maps +${v}`).join(', ')}.</p>
    <h3>Super Free Digs</h3>
    <p>The Mine Multiplier starts at x${p.superMult.start} and grows by ${p.superMult.perMerge} with every merge.
    A Golden Mine Map can turn any free digs into Super Free Digs, at the trigger or during the feature.</p>
    <h3>Modes</h3>
    <table>${Object.entries(p.modes).map(([k, v]) => row(modeName[k] || k, `${v.cost}x · RTP ${pct(v.rtp)}`)).join('')}</table>
    <h3>General</h3>
    <p>Maximum win is ${p.maxWin.toLocaleString()}x the ${t('stake')}; a round ends when it is reached.
    Wins are shown in the player's currency. Malfunction voids all pays and plays.</p>`;
  for (const c of document.querySelectorAll('canvas.sym')) {
    ctxSwap(c.getContext('2d'), () => drawSymbol(c.dataset.sym, 32, 32, 0.75));
  }
}
// Draw into another canvas using the same drawing helpers.
function ctxSwap(other, fn) { const prev = ctx; ctx = other; try { fn(); } finally { ctx = prev; } }

async function init() {
  resize(); state.dug = Array(TUNNELS).fill(0);
  const bar = $('loadBar');
  await loadAll(p => { bar.style.width = `${Math.round(p * 100)}%`; });
  if (img.page_bg) document.body.style.setProperty('--page-bg', `url(assets/${IMAGES.page_bg})`);
  loop();

  $('turbo').onchange = e => { speed = e.target.checked ? 3 : 1; };
  $('sound').onclick = () => { setMuted(!isMuted()); $('sound').setAttribute('aria-pressed', !isMuted()); };
  $('spin').onclick = () => round(spinMode);
  $('buy').onclick = () => confirmBuy('bonus');
  $('buySuper').onclick = () => confirmBuy('super');
  $('ante').onclick = () => setSpinMode('ante');
  $('feature').onclick = () => setSpinMode('feature');
  $('betUp').onclick = () => { betIndex = Math.min(betLevels.length - 1, betIndex + 1); setBet(); };
  $('betDown').onclick = () => { betIndex = Math.max(0, betIndex - 1); setBet(); };
  $('rulesBtn').onclick = () => $('rules').showModal();
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' && !busy && !document.querySelector('dialog[open]')) { e.preventDefault(); round(spinMode); }
  });

  try {
    try { paytable = await (await fetch('data/paytable.json')).json(); modes = { ...modes, ...paytable.modes }; } catch {}
    const auth = await client.authenticate();
    const cfg = auth.config || {}, jur = cfg.jurisdiction || {};
    const currency = auth.balance?.currency;
    const social = !!jur.socialCasino || currency === 'XGC' || currency === 'XSC';
    setLanguage(launch.lang, social); setCurrency(currency, launch.lang);
    applyText();
    if (jur.disabledTurbo) $('turboWrap').hidden = true;
    for (const [m, v] of Object.entries(cfg.betModes || {})) if (v?.cost) modes[m] = { ...modes[m], cost: v.cost };

    betLevels = (cfg.betLevels?.length ? cfg.betLevels : [cfg.minBet || API_MULT])
      .filter(b => (!cfg.minBet || b >= cfg.minBet) && (!cfg.maxBet || b <= cfg.maxBet) && (!cfg.stepBet || b % cfg.stepBet === 0));
    if (!betLevels.length) betLevels = [cfg.minBet || API_MULT];
    betIndex = Math.max(0, betLevels.indexOf(cfg.defaultBetLevel ?? betLevels[0]));
    setBet(); setBalance(auth.balance); setWin(0); buildRules();
    if (client.local) setStatus(t('demo'));

    $('loader').classList.add('done');
    await new Promise(r => { $('loader').onclick = r; $('loader').querySelector('.tap').hidden = false; });
    $('loader').hidden = true;
    playMusic('music_base');

    // Resume an unfinished round after a disconnect.
    if (auth.round?.active) {
      lock(true);
      const ev = eventsOf(auth.round);
      const saved = Number(auth.round.event ?? auth.round.lastEvent ?? 0) || 0;
      if (auth.round.amount) bet = auth.round.amount / (modes[(auth.round.mode || 'base').toLowerCase()]?.cost ?? 1) / API_MULT;
      await play(ev, saved);
      setBalance((await client.endRound()).balance);
      setBet(); lock(false);
    }
  } catch (err) {
    showError(err); lock(true);
    $('loader').hidden = true;
  }
}

function applyText() {
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
}

init();
