import { today } from './utils';

/** One flashcard's memory state (FSRS). */
export interface Card {
  /** day number the card is next due (see today()) */
  due: number;
  /** current interval in days; 0 while (re)learning */
  iv: number;
  /** FSRS stability (days) */
  s: number;
  /** FSRS difficulty (1–10) */
  d: number;
  /** FSRS state: 0 new, 1 learning, 2 review, 3 relearning */
  st: number;
  reps: number;
  lapses: number;
  /** last change, ms since epoch (used to merge devices) */
  last: number;
  /** marked known from the placement test / sweep, not yet confirmed */
  placed?: boolean;
}
export interface Settings {
  dir: 'es' | 'en' | 'mix';
  newPer: number;
  auto: boolean;
  voice: string;
  rate: number;
  scope: string;
  hideInstall: boolean;
}
export interface Diag {
  t: number;
  cov: number;
  typed?: number;
  b: Record<string, number>;
}
export interface AppState {
  v: 2;
  /** changes only on "reset all progress"; a newer epoch replaces older data when merging */
  epoch: number;
  ts: number;
  setTs: number;
  cards: Record<string, Card>;
  /** quiz record per word: [right, wrong] */
  q: Record<string, [number, number]>;
  /** verb tables "verb|tense": [perfectCount, attempts, lastTs, lastScore] */
  vb: Record<string, [number, number, number, number]>;
  /** reviews per day number */
  log: Record<string, number>;
  diag: Diag[];
  /** new cards introduced today: {d: day, n: count} */
  nt: { d: number; n: number };
  set: Settings;
}

export const defaultSettings = (): Settings => ({
  dir: 'es',
  newPer: 15,
  auto: true,
  voice: '',
  rate: 0.9,
  scope: 'all',
  hideInstall: false,
});
export const fresh = (): AppState => ({
  v: 2,
  epoch: Date.now(),
  ts: 0,
  setTs: 0,
  cards: {},
  q: {},
  vb: {},
  log: {},
  diag: [],
  nt: { d: 0, n: 0 },
  set: defaultSettings(),
});

/**
 * Converts a card from the original artifact (SM-2 array
 * [interval, ease, due, reps, lapses, lastTs, placedFlag]) to an FSRS card.
 */
export function migrateCard(c: unknown): Card | null {
  if (c && typeof c === 'object' && !Array.isArray(c) && 'due' in c) return c as Card;
  if (!Array.isArray(c)) return null;
  const [iv = 0, ease = 250, due = today(), reps = 0, lapses = 0, last = 0, placed = 0] = c as number[];
  // ease 130 (hardest) … 300+ (easiest) → difficulty 10 … 1
  const d = Math.min(10, Math.max(1, 10 - ((ease - 130) / 170) * 9));
  return {
    due,
    iv,
    s: Math.max(iv, 0.5),
    d: Math.round(d * 100) / 100,
    st: iv > 0 ? 2 : reps > 0 ? 3 : 1,
    reps,
    lapses,
    last,
    ...(placed ? { placed: true } : {}),
  };
}

/** Accepts saved state from this app or from the original artifact (v1) and returns a v2 state. */
export function normalize(raw: unknown): AppState {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppState> & { cards?: Record<string, unknown> };
  const base = fresh();
  const cards: Record<string, Card> = {};
  for (const [id, c] of Object.entries(o.cards || {})) {
    const m = migrateCard(c);
    if (m) cards[id] = m;
  }
  return {
    ...base,
    ...o,
    v: 2,
    epoch: o.epoch || base.epoch,
    cards,
    q: o.q || {},
    vb: o.vb || {},
    log: o.log || {},
    diag: o.diag || [],
    nt: o.nt || base.nt,
    set: { ...base.set, ...(o.set || {}) },
  };
}

/**
 * Merges progress from two devices. A newer epoch (someone reset) wins outright;
 * otherwise each card keeps whichever side changed it last, and counters keep the max.
 */
export function mergeState(a: AppState | null, b: AppState | null): AppState {
  if (!b || !b.cards) return a as AppState;
  if (!a || !a.cards) return b;
  if ((b.epoch || 0) > (a.epoch || 0)) return b;
  if ((a.epoch || 0) > (b.epoch || 0)) return a;
  const o: AppState = JSON.parse(JSON.stringify(a));
  for (const id in b.cards) {
    const x = o.cards[id],
      y = b.cards[id];
    if (!x || (y.last || 0) > (x.last || 0)) o.cards[id] = y;
  }
  for (const id in b.q) {
    const x = o.q[id] || [0, 0],
      y = b.q[id];
    o.q[id] = [Math.max(x[0], y[0]), Math.max(x[1], y[1])];
  }
  for (const d in b.log) o.log[d] = Math.max(o.log[d] || 0, b.log[d]);
  for (const k in b.vb || {}) {
    const x = o.vb[k],
      y = b.vb[k];
    if (!x || (y[2] || 0) > (x[2] || 0)) o.vb[k] = y;
  }
  const seen = new Set(o.diag.map((x) => x.t));
  (b.diag || []).forEach((x) => {
    if (!seen.has(x.t)) o.diag.push(x);
  });
  o.diag.sort((x, y) => x.t - y.t);
  if ((b.setTs || 0) > (o.setTs || 0)) {
    o.set = { ...o.set, ...b.set };
    o.setTs = b.setTs;
  }
  if (b.nt) {
    if (b.nt.d > o.nt.d) o.nt = b.nt;
    else if (b.nt.d === o.nt.d) o.nt.n = Math.max(o.nt.n, b.nt.n);
  }
  o.ts = Math.max(a.ts || 0, b.ts || 0);
  return o;
}

/** Backup codes are base64 of the UTF-8 JSON state (same format as the original artifact). */
export function encodeBackup(s: AppState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
export function decodeBackup(code: string): AppState {
  const bin = atob(code.replace(/\s+/g, ''));
  const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  const o = JSON.parse(json);
  if (!o || !o.cards) throw new Error('not a backup code');
  return normalize(o);
}
