// All player-facing text in one place, ready for translation.
// Stake passes ?lang=xx; add a block per language (falls back to English).
// SOCIAL overrides apply when the RGS reports jurisdiction.socialCasino
// (stake.us style sweepstakes): no betting/buying/cash language.

const EN = {
  balance: 'Balance', win: 'Win', bet: 'Bet', stake: 'bet', dig: 'DIG',
  ante: 'Ante Dig', anteSub: 'more Mine Maps · {cost}x',
  feature: 'Feature Spins', featureSub: '2 maps every spin · {cost}x',
  buyBonus: 'Buy Free Digs', buySuper: 'Buy Super Bonus',
  turbo: 'Turbo', sound: 'Sound', rules: 'Rules', close: 'Close',
  loading: 'Loading the mine…', tapToStart: 'Tap to start',
  demo: 'Demo mode: replaying sample rounds. Launch from Stake Engine for real play.',
  confirmBuy: '{name} for {amount}?', confirm: 'Confirm', cancel: 'Cancel',
  mysterySpin: 'MYSTERY SPIN! A goblin in every tunnel',
  mysteryOre: 'MYSTERY ORE → {symbol}',
  goldenUpgrade: 'GOLDEN MAP! UPGRADED TO SUPER · MINE x{mult}',
  goldenFound: 'GOLDEN MAP FOUND!',
  freeDigs: '{n} FREE DIGS!', superDigs: '{n} SUPER FREE DIGS! MINE x{mult}',
  moreDigs: '+{n} FREE DIGS', moreDig: '+1 FREE DIG',
  freeDigsWon: 'FREE DIGS WON {amount}', superDigsWon: 'SUPER FREE DIGS WON {amount}',
  hudFree: 'FREE DIG {i}/{n}', hudSuper: 'SUPER FREE DIG {i}/{n}', hudMine: 'MINE x{mult}',
  maxWin: 'MAX WIN! {amount}', bigWin: 'BIG WIN {amount}', megaWin: 'MEGA WIN {amount}',
  maps: '{n} Mine Maps', boulder: 'BOULDER!', merge: 'MERGE x{mult}',
  errors: {
    ERR_IPB: 'Not enough balance for this play.',
    ERR_IS: 'Your session has expired. Please reload the game.',
    ERR_ATE: 'Authentication failed. Please reload the game.',
    ERR_GLE: 'Gambling limit reached.',
    ERR_LOC: 'This game is not available in your location.',
    ERR_VAL: 'Invalid request. Please reload the game.',
    ERR_MAINTENANCE: 'The game is under maintenance. Please try again later.',
    ERR_GEN: 'Something went wrong. Please try again.',
    network: 'Connection problem. Please check your connection and try again.',
  },
};

const SOCIAL = {
  bet: 'Play', stake: 'play amount', buyBonus: 'Get Free Digs', buySuper: 'Get Super Bonus',
  confirmBuy: '{name} for {amount}?',
  demo: 'Demo mode.',
  errors: { ERR_IPB: 'Not enough coins for this play.', ERR_GLE: 'Play limit reached.' },
};

const LANGS = { en: EN };

let dict = EN;
export function setLanguage(lang, social) {
  const base = LANGS[(lang || 'en').slice(0, 2).toLowerCase()] || EN;
  dict = social ? { ...base, ...SOCIAL, errors: { ...base.errors, ...SOCIAL.errors } } : base;
}

export function t(key, vars = {}) {
  const s = key.split('.').reduce((o, k) => o?.[k], dict) ?? key.split('.').reduce((o, k) => o?.[k], EN) ?? key;
  return String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

// ---- money formatting ----
const SOCIAL_CURRENCIES = { XGC: 'GC', XSC: 'SC' };
let currency = 'USD', lang = 'en';
export function setCurrency(c, l) { currency = c || 'USD'; lang = l || 'en'; }

/** Format a value in display units (e.g. 1.5 = 1.50 of the currency). */
export function formatMoney(v) {
  if (SOCIAL_CURRENCIES[currency]) return `${SOCIAL_CURRENCIES[currency]} ${v.toFixed(2)}`;
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  } catch {
    // Crypto / non-ISO codes: plain number plus code.
    return `${v.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 8 })} ${currency}`;
  }
}
