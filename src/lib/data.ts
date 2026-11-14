import wordsJson from '../data/words.json';
import verbsJson from '../data/verbs.json';

export type Tier = 'C' | 'P' | 'H' | 'M' | 'R';
export interface Word {
  id: string;
  es: string;
  /** part of speech */
  t: string;
  en: string;
  /** category */
  c: string;
  k: Tier;
  /** usage note */
  n?: string;
  /** sample sentence */
  s: string;
  /** cloze slice [start, end) of s */
  z: [number, number];
  /** study order */
  i: number;
}
export type TenseKey = 'pres' | 'pret' | 'impf';
export interface Verb {
  v: string;
  en: string;
  k: string;
  f: Record<TenseKey, string[]>;
}

export const W: Word[] = (wordsJson as Omit<Word, 'i'>[]).map((w, i) => ({ ...w, i }));
export const BY: Record<string, Word> = Object.fromEntries(W.map((w) => [w.id, w]));
export const VERBS: Verb[] = verbsJson as Verb[];
export const VBY: Record<string, Verb> = Object.fromEntries(VERBS.map((v) => [v.v, v]));
export const VSORT = VERBS.slice().sort((a, b) => a.v.localeCompare(b.v, 'es'));

export const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'ellos / ustedes'];
export const TENSE_KEYS: TenseKey[] = ['pres', 'pret', 'impf'];
export const TENSES: Record<TenseKey, string> = { pres: 'Present', pret: 'Preterite', impf: 'Imperfect' };
export const VNOTE: Record<string, string> = {
  haber: 'ha → impersonal form is hay (there is/are)',
  gustar: 'Usually used as me gusta / me gustan',
};
export const TIER: Record<Tier, string> = { C: 'Critical', P: 'Phrases', H: 'High', M: 'Medium', R: 'Core' };
export const TIER_ORDER: Tier[] = ['C', 'P', 'H', 'M', 'R'];
export const CATS = [...new Set(W.map((w) => w.c))];
const CORE_CATS = [...new Set(W.filter((w) => w.k === 'R').map((w) => w.c))];

export interface Band {
  k: string;
  label: string;
  f: (w: Word) => boolean;
}
export const BANDS: Band[] = [
  { k: 'C', label: 'Critical', f: (w) => w.k === 'C' },
  { k: 'P', label: 'Phrases', f: (w) => w.k === 'P' },
  { k: 'H', label: 'High', f: (w) => w.k === 'H' },
  { k: 'M', label: 'Medium', f: (w) => w.k === 'M' },
  ...CORE_CATS.map((c, i) => ({ k: 'R' + (i + 1), label: c, f: (w: Word) => w.c === c })),
];

export const TIER_COUNTS = TIER_ORDER.map((k) => `${W.filter((w) => w.k === k).length} ${TIER[k]}`).join(' · ');
