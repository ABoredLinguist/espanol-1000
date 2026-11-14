// Pulls the word and verb JSON out of the original artifact HTML.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync(new URL('../reference/original-artifact.html', import.meta.url), 'utf8');
function block(id: string) {
  const m = html.match(new RegExp(`<script id="${id}" type="application/json">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`missing #${id}`);
  return JSON.parse(m[1]);
}
const words = block('data'), verbs = block('verbs');
writeFileSync(new URL('../src/data/words.json', import.meta.url), JSON.stringify(words));
writeFileSync(new URL('../src/data/verbs.json', import.meta.url), JSON.stringify(verbs));
console.log(`words: ${words.length}, verbs: ${verbs.length}`);
