// Asset slots. Drop files into web/assets/ with these exact names and the
// game uses them; any missing file falls back to the built-in placeholder
// drawing, so the game always runs. Sizes are recommended, not required:
// images are scaled to fit their slot, keeping their aspect ratio.
// See web/assets/README.md for the full list with sizes.

export const IMAGES = {
  // Treasures and buried blanks (transparent PNG/WebP, square, ~200x200)
  coin: 'symbols/coin.png',
  ring: 'symbols/ring.png',
  gem: 'symbols/gem.png',
  crown: 'symbols/crown.png',
  hoard: 'symbols/hoard.png',
  mystery: 'symbols/mystery.png',
  boulder: 'symbols/boulder.png',
  rock: 'symbols/rock.png',
  bones: 'symbols/bones.png',
  dirt: 'symbols/dirt.png',

  // Goblins (transparent, square, ~240x240). goblin_2..5 are optional
  // bigger merged goblins; without them `goblin` is scaled up.
  goblin: 'goblins/goblin.png',
  goblin_2: 'goblins/goblin_2.png',
  goblin_3: 'goblins/goblin_3.png',
  goblin_4: 'goblins/goblin_4.png',
  goblin_5: 'goblins/goblin_5.png',

  // Surface scatters (transparent, ~200x160)
  map: 'surface/map.png',
  map_golden: 'surface/map_golden.png',

  // Backgrounds: the sky/surface strip above the mine (1200x220)
  sky_base: 'backgrounds/sky_base.png',
  sky_free: 'backgrounds/sky_free.png',
  sky_super: 'backgrounds/sky_super.png',
  // Zone bands behind the cells (1200x400 each, two layers tall)
  zone_topsoil: 'backgrounds/zone_topsoil.png',
  zone_stone: 'backgrounds/zone_stone.png',
  zone_deep: 'backgrounds/zone_deep.png',

  // Cells (square, ~200x200). Covered = still buried, open = dug out.
  cell_covered: 'cells/cell_covered.png',
  cell_open: 'cells/cell_open.png',

  // Branding
  logo: 'ui/logo.png',            // ~800x300, shown on the loading screen and in the rules
  page_bg: 'ui/page_bg.jpg',      // optional full-page background behind everything (1920x1080)
};

// Sounds (MP3 or OGG). Optional; silent if missing.
export const SOUNDS = {
  drop: 'sounds/drop.mp3',
  dig: 'sounds/dig.mp3',
  collect: 'sounds/collect.mp3',
  boulder: 'sounds/boulder.mp3',
  merge: 'sounds/merge.mp3',
  mystery: 'sounds/mystery.mp3',
  map: 'sounds/map.mp3',
  trigger: 'sounds/trigger.mp3',
  super: 'sounds/super.mp3',
  win: 'sounds/win.mp3',
  bigwin: 'sounds/bigwin.mp3',
  music_base: 'sounds/music_base.mp3',
  music_free: 'sounds/music_free.mp3',
};

const BASE = 'assets/';
export const img = {};      // key -> HTMLImageElement (only the ones that loaded)
const snd = {};             // key -> HTMLAudioElement
let muted = false, music = null;

function loadImage(key, path) {
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => { img[key] = im; resolve(); };
    im.onerror = () => resolve();          // missing -> placeholder drawing
    im.src = BASE + path;
  });
}

function loadSound(key, path) {
  return new Promise(resolve => {
    const a = new Audio();
    const done = () => resolve();
    a.addEventListener('canplaythrough', () => { snd[key] = a; done(); }, { once: true });
    a.addEventListener('error', done, { once: true });
    setTimeout(done, 4000);                // never block loading on audio
    a.preload = 'auto'; a.src = BASE + path;
  });
}

export async function loadAll(onProgress) {
  const jobs = [
    ...Object.entries(IMAGES).map(([k, p]) => () => loadImage(k, p)),
    ...Object.entries(SOUNDS).map(([k, p]) => () => loadSound(k, p)),
  ];
  let n = 0;
  await Promise.all(jobs.map(j => j().then(() => onProgress?.(++n / jobs.length))));
}

/** Draw image `key` centred at (x, y) fitting inside w x h. Returns false if not loaded. */
export function drawImg(ctx, key, x, y, w, h) {
  const im = img[key];
  if (!im) return false;
  const k = Math.min(w / im.naturalWidth, h / im.naturalHeight);
  const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
  ctx.drawImage(im, x - dw / 2, y - dh / 2, dw, dh);
  return true;
}

/** Fill a rectangle with image `key` stretched to cover it. */
export function fillImg(ctx, key, x, y, w, h) {
  const im = img[key];
  if (!im) return false;
  ctx.drawImage(im, x, y, w, h);
  return true;
}

export function play(key, volume = 1) {
  const a = snd[key];
  if (!a || muted) return;
  const c = a.cloneNode();
  c.volume = volume;
  c.play().catch(() => {});
}

export function playMusic(key) {
  if (music?.key === key) return;
  music?.el.pause();
  const a = snd[key];
  music = a ? { key, el: a } : null;
  if (a) { a.loop = true; a.volume = 0.35; if (!muted) a.play().catch(() => {}); }
}

export function setMuted(m) {
  muted = m;
  if (music) m ? music.el.pause() : music.el.play().catch(() => {});
}
export const isMuted = () => muted;
