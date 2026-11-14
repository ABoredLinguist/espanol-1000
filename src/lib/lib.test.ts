import { describe, expect, it } from 'vitest';
import { BY, W } from './data';
import { checkCloze, checkTyped, czParts, esVariants, enVariants, synonymHit } from './check';
import { clean, lev, stripAcc, today } from './utils';
import { decodeBackup, encodeBackup, fresh, mergeState, migrateCard, normalize } from './state';
import { sched, placedCard, dueTodayCard } from './schedule';

describe('text helpers', () => {
  it('cleans punctuation and case', () => {
    expect(clean('¿Qué  TAL?')).toBe('qué tal');
  });
  it('strips accents', () => {
    expect(stripAcc('árbol niño')).toBe('arbol nino');
  });
  it('computes edit distance', () => {
    expect(lev('gracias', 'grasias')).toBe(1);
    expect(lev('', 'abc')).toBe(3);
  });
  it('rolls the day over at 4 am local time', () => {
    const late = new Date(2026, 0, 2, 2, 0).getTime(); // 2 am Jan 2
    const morning = new Date(2026, 0, 2, 9, 0).getTime();
    expect(today(morning) - today(late)).toBe(1);
  });
});

describe('answer checking', () => {
  const de = BY['C1']; // de: of; from
  it('accepts any English meaning', () => {
    expect(checkTyped('from', de, 'es').ok).toBe(true);
    expect(checkTyped('of', de, 'es').ok).toBe(true);
    expect(checkTyped('dog', de, 'es').ok).toBe(false);
  });
  it('forgives missing accents and points them out', () => {
    const si = BY['C7']; // sí
    expect(checkTyped('si', si, 'en')).toEqual({ ok: true, note: 'Correct, but check the accents.' });
  });
  it('makes articles optional', () => {
    const w = W.find((x) => x.es === 'el estómago')!;
    expect(esVariants(w).has('estómago')).toBe(true);
    expect(checkTyped('el estomago', w, 'en').ok).toBe(true);
  });
  it('forgives one typo in longer words', () => {
    const w = BY['C32']; // gracias
    expect(checkTyped('grasias', w, 'en').note).toBe('Correct (small typo).');
  });
  it('drops "to" from English verbs', () => {
    const w = W.find((x) => x.es === 'cocinar')!;
    expect(enVariants(w).has('cook')).toBe(true);
    expect(checkTyped('to cook', w, 'es').ok).toBe(true);
  });
  it('checks cloze blanks', () => {
    const w = BY['C3']; // Mis llaves están en la mesa.
    expect(czParts(w)[1]).toBe('en');
    expect(checkCloze('en', w).ok).toBe(true);
    expect(checkCloze('de', w).ok).toBe(false);
  });
  it('every cloze blank is accepted by its own checker', () => {
    for (const w of W) expect(checkCloze(czParts(w)[1], w).ok, w.id).toBe(true);
  });
  it('finds synonyms from other list words', () => {
    const w = BY['C30']; // adiós: goodbye
    expect(synonymHit('adios', w)).toBeNull();
  });
});

describe('state', () => {
  it('migrates original SM-2 cards', () => {
    const c = migrateCard([30, 250, 20000, 4, 1, 123, 0])!;
    expect(c).toMatchObject({ iv: 30, due: 20000, reps: 4, lapses: 1, last: 123, st: 2 });
    expect(c.placed).toBeUndefined();
    expect(migrateCard([40, 250, 20000, 1, 0, 5, 1])!.placed).toBe(true);
  });
  it('reads the original backup code format', () => {
    // The (empty) backup code from the original artifact.
    const code =
      'eyJ2IjoxLCJlcG9jaCI6MTc5NDYyOTkxNzYwMSwidHMiOjAsInNldFRzIjowLCJjYXJkcyI6e30sInEiOnt9LCJ2YiI6e30sImxvZyI6e30sImRpYWciOltdLCJudCI6eyJkIjoyMDc3MCwibiI6MH0sInNldCI6eyJkaXIiOiJlcyIsIm5ld1BlciI6MTUsImF1dG8iOnRydWUsInZvaWNlIjoiIiwicmF0ZSI6MC45LCJzY29wZSI6ImFsbCIsImhpZGVJbnN0YWxsIjpmYWxzZX19';
    const s = decodeBackup(code);
    expect(s.v).toBe(2);
    expect(s.epoch).toBe(1794629917601);
    expect(s.set.newPer).toBe(15);
  });
  it('round-trips backup codes with accents', () => {
    const s = fresh();
    s.set.voice = 'Mónica';
    s.cards.C1 = placedCard();
    const back = decodeBackup(encodeBackup(s));
    expect(back.set.voice).toBe('Mónica');
    expect(back.cards.C1.placed).toBe(true);
  });
  it('merges two devices card by card', () => {
    const a = fresh();
    const b = normalize(structuredClone(a));
    a.cards.C1 = { ...placedCard(), last: 100 };
    b.cards.C1 = { ...placedCard(), last: 200, iv: 99 };
    b.cards.C2 = placedCard();
    a.log['1'] = 5;
    b.log['1'] = 3;
    const m = mergeState(a, b);
    expect(m.cards.C1.iv).toBe(99);
    expect(m.cards.C2).toBeDefined();
    expect(m.log['1']).toBe(5);
  });
  it('lets a reset (newer epoch) win', () => {
    const a = fresh();
    a.cards.C1 = placedCard();
    const b = { ...fresh(), epoch: a.epoch + 1 };
    expect(mergeState(a, b).cards.C1).toBeUndefined();
  });
});

describe('FSRS scheduling', () => {
  const now = Date.now();
  it('repeats "Again" in the same session', () => {
    const r = sched(undefined, 0, false, now);
    expect(r.again).toBe(true);
    expect(r.card.due).toBe(today(now));
  });
  it('orders intervals Hard ≤ Good ≤ Easy', () => {
    const [h, g, e] = [1, 2, 3].map((x) => sched(undefined, x as 1 | 2 | 3, false, now).iv);
    expect(h).toBeLessThanOrEqual(g);
    expect(g).toBeLessThanOrEqual(e);
  });
  it('grows the interval on repeated Good', () => {
    let c = sched(undefined, 2, false, now).card;
    const first = c.iv;
    const later = now + c.iv * 864e5;
    c = sched(c, 2, false, later).card;
    expect(c.iv).toBeGreaterThan(first);
  });
  it('schedules migrated SM-2 cards', () => {
    const c = migrateCard([10, 250, today(now), 3, 0, now - 10 * 864e5, 0])!;
    const r = sched(c, 2, false, now);
    expect(r.iv).toBeGreaterThan(10);
  });
  it('pulls a mastered card back to today with a shorter interval', () => {
    const c = { ...placedCard(now), iv: 60 };
    const d = dueTodayCard(c, now);
    expect(d.due).toBe(today(now));
    expect(d.iv).toBe(20);
  });
});
