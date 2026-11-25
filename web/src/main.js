// Goblin Tunnels front end: draws the mine and plays back book events.
import { createClient, eventsOf, API_MULT } from './rgs.js';

const TUNNELS = 5, LAYERS = 6;
const W = 600, H = 760, TOP = 110, ROW = 100, COLW = W / TUNNELS;
const ZONES = [
  { from: 1, to: 2, name: 'TOPSOIL', color: '#5b3a22' },
  { from: 3, to: 4, name: 'STONE', color: '#4a4440' },
  { from: 5, to: 6, name: 'DEEP VEIN', color: '#2d2438' },
];

const $ = id => document.getElementById(id);
const canvas = $('board');
const ctx = canvas.getContext('2d');

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
  const sky = ctx.createLinearGradient(0, 0, 0, TOP);
  sky.addColorStop(0, state.freeSpins ? '#3b1f5c' : '#2a3a52'); sky.addColorStop(1, '#6b4a2a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, TOP);
  rect(0, TOP - 8, W, 8, '#3f7a2c');
  // zones
  for (const z of ZONES) {
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
        ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(x + 8, cy - ROW / 2 + 8, COLW - 16, ROW - 16, 12);
        const sym = state.board?.[t][l - 1];
        if (sym && !state.collected?.has(`${t}:${l}`)) drawSymbol(sym, cx, cy);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.04)'; roundRect(x + 8, cy - ROW / 2 + 8, COLW - 16, ROW - 16, 12);
        if (state.peek && state.board) { ctx.save(); ctx.globalAlpha = .18; drawSymbol(state.board[t][l - 1], cx, cy, .8); ctx.restore(); }
      }
    }
    // surface item
    const s = state.surface[t];
    if (s.kind === 'map' && !state.goblins.some(g => g.tunnel === t && g.y > TOP)) {
      const [mx] = cellCenter(t, 0);
      rect(mx - 26, TOP - 62, 52, 40, '#e9d5a1'); ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2; ctx.strokeRect(mx - 26, TOP - 62, 52, 40);
      label('✕', mx + 8, TOP - 44, '#c0392b', 18); ctx.setLineDash([3, 3]); line(mx - 18, TOP - 30, mx + 4, TOP - 44); ctx.setLineDash([]);
      label('MAP', mx, TOP - 12, '#e9d5a1', 10);
    }
  }
  for (const g of state.goblins) drawGoblin(g);
  for (const p of state.popups) { ctx.save(); ctx.globalAlpha = p.a; label(p.text, p.x, p.y, p.color || '#ffd766', p.size || 18); ctx.restore(); }
  // free spin HUD
  if (state.freeSpins) {
    label(`FREE DIG ${state.freeSpins.i}/${state.freeSpins.n}`, 90, 20, '#e7c9ff', 15);
    label(`MINE x${state.mineMult}`, W - 70, 20, '#ffd766', 16);
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
let bet = 1;          // display units
const money = cents => (cents / 100 * bet).toFixed(2);   // book amounts are x100 of the bet
let roundWin = 0;

async function play(events) {
  roundWin = 0; setWin(0); state.mineMult = 1; state.freeSpins = null; banner();
  for (const e of events) {
    const fn = handlers[e.type];
    if (fn) await fn(e);
  }
  state.freeSpins = null;
}

const goblinAt = t => state.goblins.find(g => g.tunnel === t);

const handlers = {
  async reveal(e) {
    state.board = e.board; state.surface = e.surface; state.dug = Array(TUNNELS).fill(0);
    state.collected = new Set(); state.goblins = [];
    // drop goblins from the sky onto the surface
    const drops = [];
    e.surface.forEach((s, t) => {
      if (s.kind !== 'goblin') return;
      const [x] = cellCenter(t, 0);
      const g = { tunnel: t, x, y: -40, size: 1, mult: 1, power: s.power, haul: 0 };
      state.goblins.push(g);
      drops.push(wait(t * 90).then(() => tween(g, { y: TOP - 34 }, 380)));
    });
    await Promise.all(drops);
    const maps = e.surface.filter(s => s.kind === 'map').length;
    if (maps) setStatus(`${maps} Mine Map${maps > 1 ? 's' : ''}${maps >= 3 ? '!' : ''}`);
    await wait(250);
  },
  async dig(e) {
    const g = goblinAt(e.tunnel); if (!g) return;
    const values = new Map(e.collected.map(c => [c.layer, c.value]));
    for (let l = e.from + 1; l <= e.to; l++) {
      state.dug[e.tunnel] = l;
      const [, cy] = cellCenter(e.tunnel, l);
      g.power = Math.max(0, (g.power ?? 0) - (state.board[e.tunnel][l - 1] === 'boulder' ? 2 : 1));
      await tween(g, { y: cy }, 260);
      if (values.has(l)) {
        state.collected.add(`${e.tunnel}:${l}`);
        g.haul += values.get(l);
        popup(`+${money(values.get(l))}`, g.x, cy - 30);
        await wait(140);
      }
    }
    if (e.blockedBy) popup('BOULDER!', g.x, cellCenter(e.tunnel, e.blockedBy)[1], '#cfcfcf', 14);
    g.power = null;
    await wait(120);
  },
  async merge(e) {
    const a = goblinAt(e.from), b = goblinAt(e.into); if (!a || !b) return;
    // break through the wall between the two tunnels
    await tween(a, { x: b.x, alpha: 0.3 }, 320);
    state.goblins.splice(state.goblins.indexOf(a), 1);
    b.size = e.size; b.mult = e.multiplier; b.haul = e.haul; b.power = e.bonusPower;
    popup(`MERGE x${e.multiplier}`, b.x, b.y - 40, '#ff7a8a', 20);
    await wait(380);
  },
  async mineMultiplier(e) { state.mineMult = e.value; popup(`MINE x${e.value}`, W - 70, 40, '#ffd766', 18); await wait(200); },
  async spinWin(e) {
    for (const r of e.goblins) {
      const g = goblinAt(r.tunnel);
      if (g) popup(`${money(r.win)}`, g.x, g.y + 34, '#7dff6a', 20);
    }
    if (e.mineMultiplier > 1) popup(`x${e.mineMultiplier}`, W / 2, H / 2, '#ffd766', 32);
    await wait(650);
  },
  async setTotalWin(e) { roundWin = e.amount; setWin(roundWin); },
  async freeSpinTrigger(e) {
    state.freeSpins = { i: 0, n: e.totalFs };
    await banner(`${e.totalFs} FREE DIGS!`, 1600);
  },
  async freeSpinRetrigger(e) { state.freeSpins.n = e.totalFs; await banner(`+ MORE FREE DIGS (${e.totalFs})`, 1100); },
  async updateFreeSpin(e) { state.freeSpins = { i: e.amount, n: e.total }; },
  async freeSpinEnd(e) { await banner(`FREE DIGS WON ${money(e.amount)}`, 1600); },
  async finalWin(e) {
    roundWin = e.amount; setWin(roundWin);
    const x = e.amount / 100;
    if (e.capped) await banner(`MAX WIN! ${money(e.amount)}`, 2200);
    else if (x >= 20) await banner(`${x >= 100 ? 'MEGA' : 'BIG'} WIN ${money(e.amount)}`, 1800);
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
let betLevels = [API_MULT], betIndex = 0, busy = false, balance = 0;

const fmt = micro => (micro / API_MULT).toFixed(2);
function setWin(cents) { $('win').textContent = money(cents); }
function setStatus(t) { $('status').textContent = t || ''; }
function setBalance(b) { balance = b.amount; $('balance').textContent = `${fmt(b.amount)} ${b.currency || ''}`; }
function setBet() {
  bet = betLevels[betIndex] / API_MULT;
  $('bet').textContent = bet.toFixed(2);
  $('buyCost').textContent = (bet * 100).toFixed(2);
}
function lock(on) { busy = on; for (const id of ['spin', 'buy', 'betUp', 'betDown']) $(id).disabled = on; }

async function round(mode) {
  if (busy) return;
  lock(true); setStatus('');
  try {
    const res = await client.play(betLevels[betIndex], mode);
    setBalance(res.balance);
    await play(res.events);
    // Stake: rounds with a payout stay active until end-round credits them.
    if (res.round?.active) setBalance((await client.endRound()).balance);
  } catch (err) {
    setStatus(err.message);
  } finally { lock(false); }
}

async function init() {
  resize(); state.dug = Array(TUNNELS).fill(0); loop();
  $('turbo').onchange = e => { speed = e.target.checked ? 3 : 1; };
  $('spin').onclick = () => round('base');
  $('buy').onclick = () => round('bonus');
  $('betUp').onclick = () => { betIndex = Math.min(betLevels.length - 1, betIndex + 1); setBet(); };
  $('betDown').onclick = () => { betIndex = Math.max(0, betIndex - 1); setBet(); };
  window.addEventListener('keydown', e => { if (e.code === 'Space' && !busy) { e.preventDefault(); round('base'); } });
  try {
    const auth = await client.authenticate();
    setBalance(auth.balance);
    betLevels = auth.config?.betLevels?.length ? auth.config.betLevels : [API_MULT];
    betIndex = Math.max(0, betLevels.indexOf(auth.config?.defaultBetLevel ?? API_MULT));
    setBet();
    if (client.local) setStatus('Demo mode: replaying sample books. Launch from Stake Engine for real play.');
    // Resume an unfinished round after a disconnect.
    if (auth.round?.active) { lock(true); await play(eventsOf(auth.round)); setBalance((await client.endRound()).balance); lock(false); }
  } catch (err) { setStatus(`Could not connect: ${err.message}`); lock(true); }
}
init();
