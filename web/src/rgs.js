// Stake Engine RGS client, plus a local mock that replays sample books.
//
// Stake launches the game with ?sessionID=…&rgs_url=…&lang=…&currency=…
// RGS money is integers with 6 decimals (1_000_000 = 1.00).
// A round's `state` is the book's events list produced by the math model.

export const API_MULT = 1_000_000;

export function createClient() {
  const q = new URLSearchParams(location.search);
  const sessionID = q.get('sessionID');
  const rgsUrl = q.get('rgs_url');
  if (sessionID && rgsUrl) return new RgsClient(sessionID, rgsUrl, q.get('lang') || 'en');
  return new LocalClient();
}

class RgsClient {
  constructor(sessionID, rgsUrl, lang) {
    this.sessionID = sessionID;
    this.base = rgsUrl.startsWith('http') ? rgsUrl : `https://${rgsUrl}`;
    this.lang = lang;
    this.local = false;
  }
  async post(path, body) {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionID: this.sessionID, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.message || data.error || `RGS ${res.status}`);
    return data;
  }
  async authenticate() {
    const d = await this.post('/wallet/authenticate', { language: this.lang });
    return { balance: d.balance, config: d.config, round: d.round };
  }
  async play(amount, mode) {
    const d = await this.post('/wallet/play', { amount, mode });
    return { balance: d.balance, round: d.round, events: eventsOf(d.round) };
  }
  async endRound() {
    const d = await this.post('/wallet/end-round', {});
    return { balance: d.balance };
  }
}

export function eventsOf(round) {
  if (!round) return [];
  const s = round.state;
  return Array.isArray(s) ? s : (s && s.events) || [];
}

class LocalClient {
  constructor() { this.local = true; this.balance = 10000 * API_MULT; this.books = {}; this.pending = 0; this.modes = {}; }
  async load(mode) {
    if (!this.books[mode]) this.books[mode] = await (await fetch(`books/${mode}.json`)).json();
    return this.books[mode];
  }
  async authenticate() {
    this.modes = await (await fetch('books/modes.json')).json();
    return {
      balance: { amount: this.balance, currency: 'DEMO' },
      config: { betLevels: [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].map(x => x * API_MULT), defaultBetLevel: API_MULT,
                betModes: this.modes },
      round: null,
    };
  }
  async play(amount, mode) {
    const cost = this.modes[mode]?.cost ?? 1;
    if (amount * cost > this.balance) throw new Error('Not enough demo balance');
    this.balance -= amount * cost;
    const books = await this.load(mode);
    const book = books[Math.floor(Math.random() * books.length)];
    this.pending = Math.round(amount * book.payoutMultiplier / 100);
    const round = { mode, amount: amount * cost, payoutMultiplier: book.payoutMultiplier / 100, state: book.events, active: this.pending > 0 };
    return { balance: { amount: this.balance, currency: 'DEMO' }, round, events: book.events };
  }
  async endRound() {
    this.balance += this.pending; this.pending = 0;
    return { balance: { amount: this.balance, currency: 'DEMO' } };
  }
}
