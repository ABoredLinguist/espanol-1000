// App-wide progress state, saved to this device and (optionally) synced to an account.
import { useEffect, useState } from 'preact/hooks';
import { BY, TIER, VERBS, W, TENSE_KEYS, type TenseKey, type Word } from './data';
import { fresh, normalize, type AppState } from './state';
import { today } from './utils';
import { speak as speakRaw } from './audio';

const LS_KEY = 'espanol1000.v3';

function load(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* private mode or corrupted: start fresh */
  }
  return fresh();
}

export let S: AppState = load();

const listeners = new Set<() => void>();
const saveHooks = new Set<() => void>();

/** Re-render every component that uses useStore(). */
export function update(): void {
  listeners.forEach((f) => f());
}
export function useStore(): number {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return 0;
}
export function onSave(f: () => void): () => void {
  saveHooks.add(f);
  return () => saveHooks.delete(f);
}

export function saveLocal(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(S));
  } catch {
    /* storage full or blocked */
  }
}
/** Call after any progress change. */
export function save(): void {
  S.ts = Date.now();
  saveLocal();
  saveHooks.forEach((f) => f());
  update();
}
export function saveSettings(): void {
  S.setTs = Date.now();
  save();
}
/** Replace the whole state (sync pull, restore, reset). */
export function replaceState(next: AppState, persist = true): void {
  S = next;
  if (persist) saveLocal();
  update();
}

/** A short message shown at the bottom of the screen (e.g. when audio can't play). */
export const notice = { text: '' };
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
export function showNotice(text: string, ms = 9000): void {
  notice.text = text;
  update();
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.text = '';
    update();
  }, ms);
}
export function hideNotice(): void {
  clearTimeout(noticeTimer);
  notice.text = '';
  update();
}

const AUDIO_HINT =
  'No sound? Turn off Silent Mode (the switch or Action button on the side of your iPhone) and turn the volume up. ' +
  'If it still stays quiet, open Settings here and pick a voice, or download a Spanish voice in iPhone Settings → Accessibility → Spoken Content → Voices.';
export const speak = (s: string) =>
  speakRaw(s, S.set.voice, S.set.rate, (why) =>
    showNotice(why === 'unsupported' ? 'This browser can’t play speech. Try Safari or Chrome.' : AUDIO_HINT),
  );

/* ---------- derived values ---------- */
export type Status = 'new' | 'learning' | 'mastered';
export function status(id: string): Status {
  const c = S.cards[id];
  if (!c) return 'new';
  return c.iv >= 21 ? 'mastered' : 'learning';
}
export function newLeft(): number {
  const t = today();
  if (S.nt.d !== t) S.nt = { d: t, n: 0 };
  return Math.max(0, S.set.newPer - S.nt.n);
}
export function countNewIntroduced(): void {
  const t = today();
  if (S.nt.d !== t) S.nt = { d: t, n: 0 };
  S.nt.n++;
}
export function logReview(): void {
  const t = today();
  S.log[t] = (S.log[t] || 0) + 1;
}
export function streak(): number {
  const t = today();
  let d = S.log[t] ? t : t - 1,
    n = 0;
  while (S.log[d]) {
    n++;
    d--;
  }
  return n;
}
export function inScope(w: Word, sc: string): boolean {
  if (!sc || sc === 'all') return true;
  if (sc.length === 1) return w.k === sc;
  return w.c === sc;
}
export function scopeLabel(sc: string): string {
  if (!sc || sc === 'all') return 'Everything, in study order';
  if (sc.length === 1) return TIER[sc as keyof typeof TIER] + ' tier';
  return sc;
}
export function counts(filter?: (w: Word) => boolean) {
  let n = 0,
    l = 0,
    m = 0;
  W.forEach((w) => {
    if (filter && !filter(w)) return;
    const s = status(w.id);
    if (s === 'new') n++;
    else if (s === 'learning') l++;
    else m++;
  });
  return { n, l, m, t: n + l + m };
}
export function dueCount(): number {
  const t = today();
  return W.filter((w) => {
    const c = S.cards[w.id];
    return c && c.due <= t && inScope(w, S.set.scope);
  }).length;
}
export function newAvailable(): number {
  return Math.min(newLeft(), W.filter((w) => !S.cards[w.id] && inScope(w, S.set.scope)).length);
}
/** Words missed most (lapses count double, quiz misses minus half of quiz hits). */
export function weakList(max: number): string[] {
  const out: [number, string][] = [];
  W.forEach((w) => {
    const c = S.cards[w.id],
      q = S.q[w.id] || [0, 0];
    const sc = (c ? c.lapses * 2 : 0) + q[1] - q[0] * 0.5;
    if (sc > 0) out.push([sc, w.id]);
  });
  return out
    .sort((a, b) => b[0] - a[0])
    .slice(0, max)
    .map((x) => x[1]);
}
export const words = (ids: string[]) => ids.map((id) => BY[id]);

/* ---------- verbs ---------- */
export function vbRec(v: string, t: TenseKey) {
  return S.vb[v + '|' + t];
}
export function vbLevel(v: string, t: TenseKey): 0 | 1 | 2 | 3 {
  const r = vbRec(v, t);
  if (!r) return 0;
  return r[3] >= 5 ? 3 : r[3] >= 3 ? 2 : 1;
}
export function vbKnown(v: string): boolean {
  return TENSE_KEYS.every((t) => vbLevel(v, t) === 3);
}
export function vbKnownCount(): number {
  return VERBS.filter((v) => vbKnown(v.v)).length;
}
