import { useEffect, useRef } from 'preact/hooks';
import { PERSONS, TENSES, TENSE_KEYS, VBY, VERBS, VNOTE, VSORT, type TenseKey } from '../lib/data';
import { update, vbKnownCount, vbKnown, vbLevel, vbRec } from '../lib/store';
import { VB, openModal, vbCheck, vbNext, vbRight, vbSetup, vbStart } from '../ui';
import { AccentBar, Prog, Seg, TopLine, typingProps } from './common';

export function Verbs() {
  if (VB.phase === 'run') return <VerbTable key={VB.idx} />;
  const o = VB.opt;
  if (VB.phase === 'done') {
    const n = VB.items.length;
    return (
      <>
        <div class="box center">
          <h2>Verb drill results</h2>
          <div class="big">
            {VB.tot.perfect}/{n}
          </div>
          <div class="mute small">
            perfect tables · {VB.tot.forms}/{n * 5} forms correct
          </div>
          {VB.newly.length > 0 && (
            <div class="fb ok" style={{ marginTop: 10 }}>
              Now fully known: <b>{VB.newly.join(', ')}</b>
            </div>
          )}
          {VB.lost.length > 0 && (
            <div class="fb no" style={{ marginTop: 10 }}>
              No longer fully known (missed a form): <b>{VB.lost.join(', ')}</b>
            </div>
          )}
          <div class="mute small" style={{ marginTop: 8 }}>
            {vbKnownCount()} of {VERBS.length} verbs fully known
          </div>
        </div>
        {VB.miss.length > 0 && (
          <div class="box">
            <h2>Not perfect yet</h2>
            <div class="list">
              {VB.miss.map((k) => {
                const [v, t] = k.split('|') as [string, TenseKey];
                return (
                  <button class="it" onClick={() => openModal({ kind: 'verb', v })}>
                    <span class="es">{v}</span>
                    <span class="gl">
                      {TENSES[t]} · {vbRec(v, t)?.[3] ?? 0}/5
                    </span>
                    <span class="mute">›</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div class="row">
          <button class="btn grow" onClick={vbSetup}>
            Change settings
          </button>
          <button class="btn primary grow" onClick={vbStart}>
            Go again
          </button>
        </div>
      </>
    );
  }

  const done3 = VERBS.reduce((n, v) => n + TENSE_KEYS.filter((t) => vbLevel(v.v, t) === 3).length, 0);
  const known = vbKnownCount();
  return (
    <>
      <div class="box">
        <h2>Verb conjugation · top {VERBS.length}</h2>
        <div class="small mute" style={{ marginBottom: 6 }}>
          Type all five forms of a verb in one tense. Uses Latin American persons (ustedes; no vosotros).
        </div>
        <label class="f">Tense</label>
        <Seg
          value={o.tense}
          options={[
            ['pres', 'Present'],
            ['pret', 'Preterite'],
            ['impf', 'Imperfect'],
            ['mix', 'All 3'],
          ]}
          onChange={(v) => {
            o.tense = v;
            update();
          }}
        />
        <label class="f" for="vset">
          Verbs
        </label>
        <select
          id="vset"
          value={o.set}
          onChange={(e) => {
            o.set = e.currentTarget.value;
            update();
          }}
        >
          {[
            ['all', `All ${VERBS.length} verbs`],
            ['open', 'Not fully known yet (missing tenses only)'],
            ['weak', 'Weakest first'],
            ['irr', 'Irregular, stem- and spelling-change'],
            ['reg', 'Regular only'],
          ].map(([v, l]) => (
            <option value={v}>{l}</option>
          ))}
          <optgroup label="One verb, every tense picked">
            {VSORT.map((v) => (
              <option value={v.v}>
                {v.v} ({v.en})
              </option>
            ))}
          </optgroup>
        </select>
        {!VBY[o.set] && (
          <>
            <label class="f">Tables per round</label>
            <Seg
              value={o.n}
              options={[
                [5, '5'],
                [10, '10'],
                [20, '20'],
              ]}
              onChange={(v) => {
                o.n = v;
                update();
              }}
            />
          </>
        )}
        <button class="btn primary block" onClick={vbStart}>
          Start
        </button>
      </div>

      <div class="box">
        <h2>Progress</h2>
        <div class="row" style={{ marginBottom: 6 }}>
          <div class="big">
            {known}
            <span class="mute" style={{ fontSize: 18 }}>
              /{VERBS.length}
            </span>
          </div>
          <div class="small mute grow">
            verbs fully known. A verb counts only when its present, preterite and imperfect tables were all 5/5 on your last try. Missing one form drops it back.
          </div>
        </div>
        <div class="bar" style={{ marginBottom: 6 }}>
          <i class="m" style={{ width: `${(known / VERBS.length) * 100}%` }} />
        </div>
        <div class="small mute" style={{ marginBottom: 8 }}>
          {done3} of {VERBS.length * 3} tense tables perfect. Tap a verb to see its full table.
        </div>
        <div class="grid3" style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 700 }}>
          <span />
          <span>PR</span>
          <span>PT</span>
          <span>IM</span>
        </div>
        <div class="grid3">
          {VSORT.map((v) => (
            <>
              <button class="linkbtn" style={{ textAlign: 'left', color: 'var(--ink)' }} onClick={() => openModal({ kind: 'verb', v: v.v })}>
                {vbKnown(v.v) ? <b style={{ color: 'var(--teal)' }}>✓ {v.v}</b> : v.v} <span class="mute small">{v.en}</span>
              </button>
              {TENSE_KEYS.map((t) => (
                <span class={`cell c${vbLevel(v.v, t)}`} title={TENSES[t]} />
              ))}
            </>
          ))}
        </div>
        <div class="legend" style={{ marginTop: 10 }}>
          <span>
            <i style={{ background: 'var(--teal)' }} />
            5/5
          </span>
          <span>
            <i style={{ background: '#b7791f99' }} />
            3–4
          </span>
          <span>
            <i style={{ background: '#c2412d88' }} />
            0–2
          </span>
          <span>
            <i style={{ background: 'var(--soft)' }} />
            not tried
          </span>
        </div>
      </div>
    </>
  );
}

function VerbTable() {
  const it = VB.items[VB.idx],
    vb = VBY[it.v],
    f = vb.f[it.t];
  const refs = [0, 1, 2, 3, 4].map(() => useRef<HTMLInputElement>(null));
  const focus = useRef(0);
  useEffect(() => {
    if (!VB.checked) refs[0].current?.focus();
  }, []);
  const ok = VB.rows ? VB.rows.filter((r) => r.ok).length : 0;
  return (
    <>
      <TopLine left={`Table ${VB.idx + 1} of ${VB.items.length}`} mid={<span class="tag">{vb.k}</span>} onQuit={vbSetup} />
      <Prog frac={VB.idx / VB.items.length} />
      <div class="box">
        <div class="row">
          <div class="grow">
            <div class="big" lang="es">
              {vb.v}
            </div>
            <div class="mute small">
              {vb.en}
              {VNOTE[vb.v] ? ' · ' + VNOTE[vb.v] : ''}
            </div>
          </div>
          <div class="tag C" style={{ fontSize: 13 }}>
            {TENSES[it.t]}
          </div>
        </div>
        <form
          style={{ marginTop: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            vbCheck(refs.map((r) => r.current?.value || ''));
          }}
        >
          {f.map((ans, i) => {
            const r = VB.rows?.[i];
            return (
              <div class="vt">
                <label for={`vb${i}`}>{PERSONS[i]}</label>
                <input
                  ref={refs[i]}
                  id={`vb${i}`}
                  {...typingProps}
                  lang="es"
                  enterKeyHint={i < 4 ? 'next' : 'done'}
                  class={r ? (r.ok ? 'ok' : 'no') : ''}
                  value={r ? r.g : undefined}
                  disabled={VB.checked}
                  onFocus={() => (focus.current = i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && i < 4) {
                      e.preventDefault();
                      refs[i + 1].current?.focus();
                    }
                  }}
                />
                {r && !r.ok && (
                  <div class="fix">
                    <span>
                      <b>{ans}</b>
                      {r.note === 'accent' ? ' · check the accent' : ''}
                    </span>
                    {r.g && (
                      <button type="button" class="btn sm" onClick={() => vbRight(i)}>
                        I was right
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!VB.checked && (
            <>
              <AccentBar target={() => refs[focus.current].current} chars={['á', 'é', 'í', 'ó', 'ú', 'ñ']} />
              <button class="btn primary block" style={{ marginTop: 6 }}>
                Check
              </button>
            </>
          )}
        </form>
        {VB.checked && (
          <>
            <div class={`fb ${ok === 5 ? 'ok' : 'no'}`} style={{ marginBottom: 0 }}>
              <b>{ok}/5 correct</b>
              {ok === 5 ? ' · ¡Perfecto!' : ''}
            </div>
            <button class="btn primary block" style={{ marginTop: 10 }} onClick={vbNext}>
              {VB.idx + 1 < VB.items.length ? 'Next table' : 'See results'}
            </button>
          </>
        )}
      </div>
      <div class="kbd">Enter moves to the next person</div>
    </>
  );
}
