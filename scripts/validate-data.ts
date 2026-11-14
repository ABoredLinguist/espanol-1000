// Checks the word and verb lists for structural problems. Exits non-zero on errors.
import { readFileSync } from 'node:fs';

const words = JSON.parse(readFileSync(new URL('../src/data/words.json', import.meta.url), 'utf8'));
const verbs = JSON.parse(readFileSync(new URL('../src/data/verbs.json', import.meta.url), 'utf8'));
const errors: string[] = [];
const warnings: string[] = [];
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ids = new Set<string>();
for (const w of words) {
  const where = `${w.id} (${w.es})`;
  if (ids.has(w.id)) errors.push(`duplicate id ${where}`);
  ids.add(w.id);
  for (const f of ['id', 'es', 't', 'en', 'c', 'k', 's']) if (!w[f]) errors.push(`${where}: missing ${f}`);
  if (!'CPHMR'.includes(w.k)) errors.push(`${where}: unknown tier ${w.k}`);
  if (!Array.isArray(w.z) || w.z.length !== 2) {
    errors.push(`${where}: missing cloze range`);
    continue;
  }
  const [a, b] = w.z;
  if (!(a >= 0 && b > a && b <= w.s.length)) {
    errors.push(`${where}: cloze range [${a},${b}] outside sentence "${w.s}"`);
    continue;
  }
  const slice = w.s.slice(a, b);
  if (/^\s|\s$/.test(slice)) errors.push(`${where}: cloze slice "${slice}" has stray spaces`);
  if (/[A-Za-zÁÉÍÓÚÑáéíóúñü]/.test(w.s[a - 1] || '') || /[A-Za-zÁÉÍÓÚÑáéíóúñü]/.test(w.s[b] || ''))
    errors.push(`${where}: cloze slice "${slice}" cuts through a word in "${w.s}"`);
  // Heuristic (non-verbs only; verbs conjugate irregularly): the blank should start like part of the headword.
  const heads = strip(w.es).replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '').split(/[\s/()]+/).filter((x: string) => x.length > 1);
  const s2 = strip(slice).split(/\s+/);
  if (!/^(v\.|phrase)/.test(w.t) && heads.length && !s2.some((x) => heads.some((h: string) => x.replace(/^[¿¡]/, '')[0] === h.replace(/^[¿¡]/, '')[0])))
    warnings.push(`${where}: blank "${slice}" doesn't look like a form of the word`);
}

for (const v of verbs) {
  for (const t of ['pres', 'pret', 'impf']) {
    const f = v.f?.[t];
    if (!Array.isArray(f) || f.length !== 5 || f.some((x: string) => !x)) errors.push(`verb ${v.v}: ${t} needs 5 forms`);
  }
}

console.log(`${words.length} words, ${verbs.length} verbs`);
if (warnings.length) console.log(`\n${warnings.length} warnings (check by hand):\n  ` + warnings.join('\n  '));
if (errors.length) {
  console.error(`\n${errors.length} errors:\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log('\nNo errors.');
