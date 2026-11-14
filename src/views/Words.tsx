import { BY, TIER, TIER_ORDER, W } from '../lib/data';
import { update, weakList } from '../lib/store';
import { plural, stripAcc } from '../lib/utils';
import { WD } from '../ui';
import { WordRow } from './common';

export function Words() {
  const q = stripAcc(WD.q.toLowerCase().trim());
  const hit = (w: (typeof W)[number]) => !q || stripAcc(w.es.toLowerCase()).includes(q) || stripAcc(w.en.toLowerCase()).includes(q);
  const L = WD.tier === 'weak' ? weakList(100).map((id) => BY[id]).filter(hit) : W.filter((w) => (WD.tier === 'all' || w.k === WD.tier) && hit(w));
  const chips: [string, string][] = [['all', 'All'], ...TIER_ORDER.map((k): [string, string] => [k, TIER[k]]), ['weak', 'Weak']];
  return (
    <>
      <input
        type="search"
        placeholder="Search Spanish or English"
        aria-label="Search words"
        value={WD.q}
        autocapitalize="off"
        autocorrect="off"
        spellcheck={false}
        style={{ marginBottom: 10 }}
        onInput={(e) => {
          WD.q = e.currentTarget.value;
          WD.lim = 120;
          update();
        }}
      />
      <div class="chips">
        {chips.map(([v, l]) => (
          <button
            class={`chip ${WD.tier === v ? 'on' : ''}`}
            aria-pressed={WD.tier === v}
            onClick={() => {
              WD.tier = v;
              WD.lim = 120;
              update();
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div class="mute small" style={{ marginBottom: 4 }}>
        {plural(L.length, 'word')}
      </div>
      <div class="box list" style={{ padding: '4px 14px' }}>
        {L.length ? L.slice(0, WD.lim).map((w) => <WordRow w={w} />) : <div class="empty">No matches</div>}
      </div>
      {L.length > WD.lim && (
        <button
          class="btn block"
          onClick={() => {
            WD.lim += 200;
            update();
          }}
        >
          Show more
        </button>
      )}
    </>
  );
}
