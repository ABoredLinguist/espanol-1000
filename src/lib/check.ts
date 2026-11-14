import { W, BY, type Word } from './data';
import { clean, lev, shuffle, stripAcc } from './utils';

export interface CheckResult {
  ok: boolean;
  note?: string;
}
const ARTICLES = /^(el|la|los|las|un|una|unos|unas)\s+/;

/** Spanish answers accepted for a word ("el / la" → both; optional "(se)" parts either way; article optional). */
export function esVariants(w: Word): Set<string> {
  const out = new Set<string>();
  const base = w.es.replace(/\+ ?(inf\.|adj\.|time|-ando\/-iendo)/g, ' ').replace(/…/g, ' ');
  base.split(/\s*\/\s*/).forEach((p) => {
    p = clean(p);
    [p.replace(/\(([^)]*)\)/g, '$1'), p.replace(/\([^)]*\)/g, '')].forEach((v) => {
      v = v.replace(/\s+/g, ' ').trim();
      if (v.length < 2 && w.es.length > 2) return;
      if (!v) return;
      out.add(v);
      out.add(v.replace(ARTICLES, ''));
    });
  });
  return out;
}

/** English answers accepted for a word (each ; , / part, minus "to/a/the" and parentheticals). */
export function enVariants(w: Word): Set<string> {
  const out = new Set<string>();
  w.en.split(/[;,/]/).forEach((p) => {
    if (p.includes('=')) return;
    const inner = (p.match(/\(([^)]*)\)/) || [])[1];
    if (inner && !/\./.test(inner) && inner.length > 2) out.add(clean(inner));
    p = clean(p.replace(/\([^)]*\)/g, ' '))
      .replace(/^(to|a|an|the)\s+/, '')
      .trim();
    if (p) out.add(p);
  });
  return out;
}

/** dir 'es' = shown Spanish, typed English; 'en' = shown English, typed Spanish. */
export function checkTyped(given: string, w: Word, dir: 'es' | 'en'): CheckResult {
  let a = clean(given).replace(/^(to|a|an|the)\s+/, '');
  if (dir === 'en') a = a.replace(ARTICLES, '');
  if (!a) return { ok: false };
  const vars = [...(dir === 'es' ? enVariants(w) : esVariants(w))];
  if (vars.includes(a)) return { ok: true };
  const a2 = stripAcc(a);
  if (vars.some((v) => stripAcc(v) === a2)) return { ok: true, note: dir === 'en' ? 'Correct, but check the accents.' : 'Correct!' };
  if (
    vars.some((v) => {
      const d = lev(stripAcc(v), a2);
      return (v.length >= 5 && d <= 1) || (v.length >= 9 && d <= 2);
    })
  )
    return { ok: true, note: 'Correct (small typo).' };
  return { ok: false };
}

export function czParts(w: Word): [string, string, string] {
  const [a, b] = w.z;
  return [w.s.slice(0, a), w.s.slice(a, b), w.s.slice(b)];
}
export function checkCloze(given: string, w: Word): CheckResult {
  const ans = czParts(w)[1];
  const g = clean(given),
    c = clean(ans);
  if (g === c) return { ok: true };
  if (stripAcc(g) === stripAcc(c)) return { ok: true, note: 'Correct, but check the accents.' };
  const d = lev(stripAcc(g), stripAcc(c));
  if (c.length >= 6 && d <= 1) return { ok: true, note: 'Correct (small typo).' };
  return { ok: false };
}

let EN_INDEX: Record<string, string[]> | null = null;
/** For the placement test: accepts a different list word with the same English meaning. */
export function synonymHit(given: string, w: Word): Word | null {
  if (!EN_INDEX) {
    const idx: Record<string, string[]> = {};
    W.forEach((x) => enVariants(x).forEach((v) => (idx[v] = idx[v] || []).push(x.id)));
    EN_INDEX = idx;
  }
  const a = stripAcc(clean(given).replace(ARTICLES, ''));
  for (const v of enVariants(w))
    for (const id of EN_INDEX[v] || []) {
      if (id === w.id) continue;
      const x = BY[id];
      if ([...esVariants(x)].some((e) => stripAcc(e) === a)) return x;
    }
  return null;
}

export function vbClean(x: string): string {
  return x
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(yo|tú|tu|él|el|ella|usted|nosotros|nosotras|ellos|ellas|ustedes)\s+/, '');
}

/** Part-of-speech group, so multiple-choice distractors are the same kind of word. */
export function posG(t: string): string {
  return t.startsWith('n') ? 'n' : t.split(/[./ ]/)[0];
}
/** Four choices (the answer + 3 distractors, same part of speech and tier first), shuffled. */
export function choicesFor(w: Word, dir: 'es' | 'en'): string[] {
  const f = dir === 'es' ? 'en' : 'es';
  const used = new Set([w[f]]);
  const out = [w];
  const pool = shuffle(W.filter((x) => x.id !== w.id && posG(x.t) === posG(w.t)));
  pool.sort((a, b) => (a.k === w.k ? 0 : 1) - (b.k === w.k ? 0 : 1));
  for (const x of [...pool, ...shuffle(W)]) {
    if (out.length >= 4) break;
    if (!used.has(x[f])) {
      used.add(x[f]);
      out.push(x);
    }
  }
  return shuffle(out).map((x) => x.id);
}
