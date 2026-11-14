export const DAYMS = 864e5;

/** Local day number; the day rolls over at 4 am so late-night study counts for "today". */
export function today(now = Date.now()): number {
  const d = new Date(now - 4 * 3600e3);
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / DAYMS);
}
export function shuffle<T>(a: readonly T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
export function sample<T>(a: readonly T[], n: number): T[] {
  return shuffle(a).slice(0, n);
}
export function pct(x: number): string {
  return Math.round((x || 0) * 100) + '%';
}
export function fmtIv(d: number): string {
  if (d <= 0) return 'now';
  if (d < 31) return d + 'd';
  if (d < 365) return (Math.round(d / 3) / 10).toFixed(1).replace('.0', '') + 'mo';
  return (d / 365).toFixed(1) + 'y';
}
export function stripAcc(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}
export function clean(s: string): string {
  return s
    .toLowerCase()
    .replace(/[¿?¡!.,;:"“”«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
/** Levenshtein edit distance. */
export function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
