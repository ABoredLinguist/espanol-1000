// Screen state (current session, quiz, drill…) and the actions that change it.
import { BANDS, BY, VBY, VERBS, W, TENSE_KEYS, type TenseKey } from './lib/data';
import { sched, placedCard, dueTodayCard, type G } from './lib/schedule';
import { checkCloze, checkTyped, choicesFor, synonymHit, vbClean, type CheckResult } from './lib/check';
import {
  S, save, update, speak, newLeft, inScope, weakList, logReview, countNewIntroduced, vbRec, vbKnown,
} from './lib/store';
import { sample, shuffle, today, stripAcc } from './lib/utils';

export type Tab = 'home' | 'cards' | 'quiz' | 'verbs' | 'test' | 'words';
export const TABS: Tab[] = ['home', 'cards', 'quiz', 'verbs', 'test', 'words'];
export function currentTab(): Tab {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.includes(h) ? h : 'home';
}
export function go(t: Tab): void {
  if (location.hash === '#' + t) update();
  else location.hash = t;
}

/* ---------- modal ---------- */
export type Modal = { kind: 'settings' } | { kind: 'word'; id: string } | { kind: 'verb'; v: string } | null;
export const ui: { modal: Modal } = { modal: null };
export function openModal(m: Modal): void {
  ui.modal = m;
  update();
}
export function closeModal(): void {
  ui.modal = null;
  update();
}

/* ---------- flashcards ---------- */
type Dir = 'es' | 'en';
export interface Session {
  mode: 'srs' | 'practice';
  queue: string[];
  done: number;
  again: number;
  flip: boolean;
  dirs: Record<string, Dir>;
  newSeen: Set<string>;
}
export let SES: Session | null = null;

function buildSession(extra: number): string[] {
  const t = today(),
    sc = S.set.scope;
  const due = W.filter((w) => {
    const c = S.cards[w.id];
    return c && c.due <= t && inScope(w, sc);
  })
    .sort((a, b) => S.cards[a.id].due - S.cards[b.id].due || a.i - b.i)
    .slice(0, 200)
    .map((w) => w.id);
  const nn = extra || newLeft();
  const nw = W.filter((w) => !S.cards[w.id] && inScope(w, sc))
    .slice(0, nn)
    .map((w) => w.id);
  // Mix one new card after every three reviews.
  const q: string[] = [];
  let i = 0,
    j = 0;
  while (i < due.length || j < nw.length) {
    for (let k = 0; k < 3 && i < due.length; k++) q.push(due[i++]);
    if (j < nw.length) q.push(nw[j++]);
  }
  return q;
}
function startSession(ids: string[], mode: Session['mode'] = 'srs'): boolean {
  if (!ids.length) {
    SES = null;
    return false;
  }
  const dirs: Record<string, Dir> = {};
  ids.forEach((id) => (dirs[id] = S.set.dir === 'mix' ? (Math.random() < 0.5 ? 'es' : 'en') : S.set.dir));
  SES = { mode, queue: ids.slice(), done: 0, again: 0, flip: false, dirs, newSeen: new Set() };
  return true;
}
export function curWord() {
  return SES && SES.queue.length ? BY[SES.queue[0]] : null;
}
function sayFront() {
  const w = curWord();
  if (w && SES && S.set.auto && SES.dirs[w.id] === 'es') speak(w.es);
}
export function startStudy(): void {
  if (!startSession(buildSession(0))) startSession(buildSession(10));
  go('cards');
  sayFront();
}
export function studyExtra(): void {
  if (startSession(buildSession(10))) {
    update();
    sayFront();
  }
}
export function drillWeak(): void {
  if (startSession(shuffle(weakList(20)), 'practice')) go('cards');
}
export function endSession(): void {
  SES = null;
  update();
}
export function flip(): void {
  const w = curWord();
  if (!SES || SES.flip || !w) return;
  SES.flip = true;
  update();
  if (S.set.auto && SES.dirs[w.id] === 'en') speak(w.es);
}
export function grade(g: G): void {
  const w = curWord();
  if (!w || !SES || !SES.flip) return;
  const id = w.id;
  SES.queue.shift();
  SES.flip = false;
  const requeue = () => {
    SES!.queue.splice(Math.min(3, SES!.queue.length), 0, id);
    SES!.again++;
  };
  if (SES.mode === 'practice') {
    if (g === 0) requeue();
    else SES.done++;
  } else {
    const c = S.cards[id];
    if (!c && !SES.newSeen.has(id)) countNewIntroduced();
    SES.newSeen.add(id);
    const r = sched(c, g, true);
    S.cards[id] = r.card;
    if (r.again) requeue();
    else SES.done++;
  }
  logReview();
  save();
  sayFront();
}

/* ---------- quiz ---------- */
export type QFmt = 'mc' | 'typed' | 'cloze';
export interface QItem {
  id: string;
  dir: Dir;
  fmt: QFmt;
  ch: string[] | null;
}
export interface QAnswer {
  ok: boolean;
  given: string;
  pick: string | null;
  note?: string;
}
export const QZ = {
  phase: 'setup' as 'setup' | 'run' | 'done',
  opt: { scope: 'studied', fmt: 'mix' as QFmt | 'mix', dir: 'mix' as Dir | 'mix', len: 20 },
  items: [] as QItem[],
  idx: 0,
  score: 0,
  missed: [] as string[],
  ans: null as QAnswer | null,
};
export function quizPool(sc: string) {
  if (sc === 'studied') return W.filter((w) => S.cards[w.id]);
  if (sc === 'weak') return weakList(60).map((id) => BY[id]);
  return W.filter((w) => inScope(w, sc));
}
function sayQuestion() {
  const it = QZ.items[QZ.idx];
  if (it && S.set.auto && it.dir === 'es' && it.fmt !== 'cloze') speak(BY[it.id].es);
}
export function startQuiz(): void {
  const o = QZ.opt,
    pool = quizPool(o.scope);
  if (!pool.length) return;
  QZ.items = sample(pool, Math.min(o.len, pool.length)).map((w) => {
    const dir: Dir = o.dir === 'mix' ? (Math.random() < 0.5 ? 'es' : 'en') : o.dir;
    let fmt: QFmt;
    if (o.fmt === 'mix') {
      const r = Math.random();
      fmt = r < 0.34 ? 'mc' : r < 0.67 ? 'typed' : 'cloze';
    } else fmt = o.fmt;
    return { id: w.id, dir, fmt, ch: fmt === 'mc' ? choicesFor(w, dir) : null };
  });
  Object.assign(QZ, { phase: 'run', idx: 0, score: 0, missed: [], ans: null });
  update();
  sayQuestion();
}
export function quizSetup(): void {
  QZ.phase = 'setup';
  update();
}
export function answerQuiz(ok: boolean, given: string, pick: string | null, note?: string): void {
  const it = QZ.items[QZ.idx];
  QZ.ans = { ok, given, pick, note };
  const q = S.q[it.id] || [0, 0];
  if (ok) {
    QZ.score++;
    q[0]++;
  } else {
    QZ.missed.push(it.id);
    q[1]++;
    S.cards[it.id] = dueTodayCard(S.cards[it.id]);
  }
  S.q[it.id] = q;
  save();
}
export function submitQuiz(value: string): void {
  if (QZ.ans || !value.trim()) return;
  const it = QZ.items[QZ.idx],
    w = BY[it.id];
  const r: CheckResult = it.fmt === 'cloze' ? checkCloze(value, w) : checkTyped(value, w, it.dir);
  answerQuiz(r.ok, value, null, r.note);
}
export function quizOverride(): void {
  const it = QZ.items[QZ.idx];
  if (!QZ.ans) return;
  QZ.missed = QZ.missed.filter((x) => x !== it.id);
  QZ.score++;
  const q = S.q[it.id];
  q[1] = Math.max(0, q[1] - 1);
  q[0]++;
  QZ.ans = { ...QZ.ans, ok: true, note: 'Counted as correct.' };
  save();
}
export function nextQ(): void {
  QZ.idx++;
  QZ.ans = null;
  if (QZ.idx >= QZ.items.length) {
    QZ.phase = 'done';
    update();
    window.scrollTo(0, 0);
    return;
  }
  update();
  sayQuestion();
}

/* ---------- placement test & sweep ---------- */
interface DgItem {
  id: string;
  band: string;
}
interface BandResult {
  ok: number;
  bad: number;
  dk: number;
  n: number;
  est: number;
}
export const DG = {
  phase: 'intro' as 'intro' | 'run' | 'done',
  items: [] as DgItem[],
  idx: 0,
  res: {} as Record<string, [number, number, number, number]>,
  right: [] as string[],
  ans: null as { ok: boolean; given: string; note?: string } | null,
  result: null as { cov: number; b: Record<string, BandResult> } | null,
};
function dgEligible(w: (typeof W)[number]) {
  return !w.en.includes('=') && !stripAcc(w.en.toLowerCase()).includes(stripAcc(w.es.replace(/^(el|la|los|las|un|una)\s+/, '').toLowerCase()));
}
export function startDiag(): void {
  const items: DgItem[] = [];
  BANDS.forEach((b) => sample(W.filter((w) => b.f(w) && dgEligible(w)), 8).forEach((w) => items.push({ id: w.id, band: b.k })));
  Object.assign(DG, { phase: 'run', items: shuffle(items), idx: 0, res: {}, right: [], ans: null });
  BANDS.forEach((b) => (DG.res[b.k] = [0, 0, 0, 0]));
  update();
}
export function quitDiag(): void {
  DG.phase = 'intro';
  update();
}
export function dgCheck(given: string): void {
  if (DG.ans) return;
  const w = BY[DG.items[DG.idx].id];
  let r: CheckResult = given ? checkTyped(given, w, 'en') : { ok: false };
  if (!r.ok && given) {
    const x = synonymHit(given, w);
    if (x) r = { ok: true, note: `Also right (${x.es}). The list word here is ${w.es}.` };
  }
  DG.ans = { ok: r.ok, given, note: r.note };
  update();
}
export function dgOverride(): void {
  if (DG.ans) DG.ans = { ...DG.ans, ok: true, note: 'Counted as correct.' };
  update();
}
export function dgNext(): void {
  const it = DG.items[DG.idx],
    r = DG.res[it.band],
    a = DG.ans!;
  r[3]++;
  if (!a.given) r[2]++;
  else if (a.ok) {
    r[0]++;
    DG.right.push(it.id);
  } else r[1]++;
  DG.idx++;
  DG.ans = null;
  if (DG.idx >= DG.items.length) {
    const b: Record<string, BandResult> = {};
    let cov = 0;
    BANDS.forEach((x) => {
      const [ok, bad, dk, n] = DG.res[x.k];
      const est = n ? ok / n : 0;
      b[x.k] = { ok, bad, dk, n, est };
      cov += est * W.filter(x.f).length;
    });
    cov /= W.length;
    DG.result = { cov, b };
    DG.phase = 'done';
    S.diag.push({ t: Date.now(), cov, typed: 1, b: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v.est * 100)])) });
    save();
    window.scrollTo(0, 0);
    return;
  }
  update();
}
export function markRight(): void {
  DG.right.forEach((id) => {
    if (!S.cards[id]) S.cards[id] = placedCard();
  });
  save();
}

export let SW: { ids: string[]; idx: number; known: number; learn: number; show: boolean; hist: [string, number][]; label: string } | null = null;
export function startSweep(k: string): void {
  const b = BANDS.find((x) => x.k === k)!;
  const ids = W.filter((w) => b.f(w) && !S.cards[w.id]).map((w) => w.id);
  if (!ids.length) return;
  SW = { ids, idx: 0, known: 0, learn: 0, show: false, hist: [], label: b.label };
  update();
  window.scrollTo(0, 0);
}
export function swToggle(): void {
  if (SW) SW.show = !SW.show;
  update();
}
export function swAns(v: 0 | 1): void {
  if (!SW) return;
  const id = SW.ids[SW.idx];
  if (!id) return;
  SW.hist.push([id, v]);
  if (v) {
    S.cards[id] = placedCard();
    SW.known++;
  } else SW.learn++;
  SW.idx++;
  SW.show = false;
  save();
}
export function swUndo(): void {
  if (!SW) return;
  const x = SW.hist.pop();
  if (!x) return;
  const [id, v] = x;
  if (v) {
    delete S.cards[id];
    SW.known--;
  } else SW.learn--;
  SW.idx--;
  SW.show = false;
  save();
}
export function endSweep(): void {
  SW = null;
  update();
}

/* ---------- verb drill ---------- */
export interface VbRow {
  ok: boolean;
  g: string;
  note?: 'accent';
}
export const VB = {
  phase: 'setup' as 'setup' | 'run' | 'done',
  opt: { tense: 'mix' as TenseKey | 'mix', set: 'all', n: 5 },
  items: [] as { v: string; t: TenseKey }[],
  idx: 0,
  checked: false,
  rows: null as VbRow[] | null,
  tot: { perfect: 0, forms: 0 },
  miss: [] as string[],
  newly: [] as string[],
  lost: [] as string[],
};
function vbPool() {
  const o = VB.opt;
  if (VBY[o.set]) return [VBY[o.set]];
  if (o.set === 'irr') return VERBS.filter((v) => v.k !== 'regular');
  if (o.set === 'reg') return VERBS.filter((v) => v.k === 'regular');
  return VERBS;
}
export function vbStart(): void {
  const o = VB.opt,
    ts = o.tense === 'mix' ? TENSE_KEYS : [o.tense];
  let combos: { v: string; t: TenseKey }[] = [];
  vbPool().forEach((v) => ts.forEach((t) => combos.push({ v: v.v, t })));
  if (o.set === 'open') combos = combos.filter((c) => (vbRec(c.v, c.t)?.[3] ?? 0) < 5);
  if (!combos.length) return;
  if (VBY[o.set]) {
    /* one verb: every picked tense, in order */
  } else if (o.set === 'weak') {
    const score = (c: { v: string; t: TenseKey }) => {
      const r = vbRec(c.v, c.t);
      return (vbKnown(c.v) ? 10 : 0) + (r ? r[3] + r[0] * 0.5 : 2.5);
    };
    combos = shuffle(combos)
      .sort((a, b) => score(a) - score(b))
      .slice(0, o.n);
  } else combos = sample(combos, o.n);
  Object.assign(VB, { phase: 'run', items: combos, idx: 0, checked: false, rows: null, tot: { perfect: 0, forms: 0 }, miss: [], newly: [], lost: [] });
  update();
}
export function vbSetup(): void {
  VB.phase = 'setup';
  update();
}
export function vbCheck(values: string[]): void {
  if (VB.checked) return;
  const it = VB.items[VB.idx],
    f = VBY[it.v].f[it.t];
  VB.rows = f.map((ans, i) => {
    const g = vbClean(values[i] || '');
    if (g === ans) return { ok: true, g };
    if (g && stripAcc(g) === stripAcc(ans)) return { ok: false, g, note: 'accent' as const };
    return { ok: false, g };
  });
  VB.checked = true;
  update();
}
export function vbRight(i: number): void {
  if (VB.rows) VB.rows[i].ok = true;
  update();
}
export function vbNext(): void {
  const it = VB.items[VB.idx],
    ok = VB.rows!.filter((r) => r.ok).length,
    key = it.v + '|' + it.t;
  const was = vbKnown(it.v);
  const r = S.vb[key] || [0, 0, 0, 0];
  r[1]++;
  if (ok === 5) r[0]++;
  r[2] = Date.now();
  r[3] = ok;
  S.vb[key] = r;
  if (!was && vbKnown(it.v)) VB.newly.push(it.v);
  if (was && !vbKnown(it.v)) VB.lost.push(it.v);
  VB.tot.forms += ok;
  if (ok === 5) VB.tot.perfect++;
  else VB.miss.push(key);
  logReview();
  VB.idx++;
  VB.checked = false;
  VB.rows = null;
  if (VB.idx >= VB.items.length) VB.phase = 'done';
  save();
  window.scrollTo(0, 0);
}
export function vbDrill(v: string): void {
  ui.modal = null;
  VB.opt.set = v;
  VB.opt.tense = 'mix';
  go('verbs');
  vbStart();
}

/* ---------- words ---------- */
export const WD = { q: '', tier: 'all', lim: 120 };

/** Clears every screen's in-progress state (after "reset all progress"). */
export function resetScreens(): void {
  SES = null;
  SW = null;
  DG.phase = 'intro';
  QZ.phase = 'setup';
  VB.phase = 'setup';
}
