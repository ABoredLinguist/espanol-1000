import { useEffect, useRef } from 'preact/hooks';
import { BANDS, BY, W } from '../lib/data';
import { S } from '../lib/store';
import { pct } from '../lib/utils';
import {
  DG, SW, dgCheck, dgNext, dgOverride, endSweep, markRight, quitDiag, startDiag, startSweep, swAns, swToggle, swUndo,
} from '../ui';
import { AccentBar, Prog, Say, TopLine, typingProps } from './common';

export function Test() {
  if (SW) return <Sweep />;
  if (DG.phase === 'run') return <DiagQuestion key={DG.idx} />;
  const r = DG.phase === 'done' ? DG.result : null;
  const freshRight = DG.right.filter((id) => !S.cards[id]);
  return (
    <>
      {r && (
        <div class="box">
          <h2>Placement results</h2>
          <div class="big">{pct(r.cov)}</div>
          <div class="mute small">
            estimated coverage of the {W.length.toLocaleString()}-word list (≈{Math.round(r.cov * W.length)} words), based on typing the Spanish from English
          </div>
          {BANDS.map((b) => (
            <div class="bandrow">
              <span>{b.label}</span>
              <div class="bar">
                <i class="m" style={{ width: `${r.b[b.k].est * 100}%` }} />
              </div>
              <span class="mute" style={{ textAlign: 'right' }}>
                {pct(r.b[b.k].est)}
              </span>
            </div>
          ))}
          {freshRight.length ? (
            <button class="btn teal block" style={{ marginTop: 10 }} onClick={markRight}>
              Mark the {freshRight.length} words I got right as known
            </button>
          ) : (
            <div class="mute small" style={{ marginTop: 8 }}>
              Words you got right are marked as known.
            </div>
          )}
          <div class="mute small" style={{ marginTop: 8 }}>
            Next step: run a quick sweep on the sections where you scored high, so you skip the words you already know.
          </div>
        </div>
      )}
      <div class="box">
        <h2>Placement test</h2>
        <div class="small" style={{ marginBottom: 10 }}>
          {BANDS.length * 8} questions, 8 from each frequency band. You see the English and type the Spanish. Takes about 10 minutes. It estimates how much of the list you can
          actually produce and shows where to focus. Retake it every few weeks to track your progress.
        </div>
        <button class="btn primary block" onClick={startDiag}>
          {S.diag.length ? 'Retake placement test' : 'Start placement test'}
        </button>
      </div>
      <div class="box">
        <h2>Quick sweep</h2>
        <div class="small mute" style={{ marginBottom: 8 }}>
          Go fast through the words you haven’t studied in a section. Tap <b>Know it</b> to skip a word for now (it gets checked once later), or <b>Learn it</b> to leave it in your
          new cards.
        </div>
        <div class="list">
          {BANDS.map((b) => {
            const n = W.filter((w) => b.f(w) && !S.cards[w.id]).length;
            const tot = W.filter(b.f).length;
            return (
              <button class="it" onClick={() => startSweep(b.k)} disabled={!n}>
                <div class="grow">
                  <div class="es">{b.label}</div>
                  <div class="gl">
                    {n} of {tot} not studied yet{r ? ` · placement ${pct(r.b[b.k].est)}` : ''}
                  </div>
                </div>
                <span class="mute">›</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function DiagQuestion() {
  const it = DG.items[DG.idx],
    w = BY[it.id],
    a = DG.ans;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!a) input.current?.focus();
  }, [a]);
  return (
    <>
      <TopLine left={`Placement · ${DG.idx + 1} of ${DG.items.length}`} onQuit={quitDiag} />
      <Prog frac={DG.idx / DG.items.length} />
      <div class="q en">{w.en}</div>
      <div class="center mute small">Type it in Spanish · {w.t}</div>
      <form
        style={{ marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.current?.value || '';
          if (v.trim()) dgCheck(v);
        }}
      >
        <input ref={input} {...typingProps} lang="es" placeholder="Escribe en español" value={a ? a.given : undefined} disabled={!!a} aria-label="Your answer" />
        {!a && (
          <>
            <AccentBar target={() => input.current} />
            <div class="row" style={{ marginTop: 6 }}>
              <button type="button" class="btn grow" onClick={() => dgCheck('')}>
                No sé
              </button>
              <button class="btn primary grow">Check</button>
            </div>
          </>
        )}
      </form>
      {a && (
        <>
          <div class={`fb ${a.ok ? 'ok' : 'no'}`}>
            <b>{a.ok ? a.note || 'Correct!' : a.given ? 'Not quite.' : 'No problem. Here it is:'}</b>
            <br />
            <b>{w.es}</b> — {w.en}
            {w.s && (
              <div class="small" style={{ marginTop: 6, fontStyle: 'italic' }}>
                {w.s}
              </div>
            )}
          </div>
          <div class="row">
            {!a.ok && a.given && (
              <button class="btn grow" onClick={dgOverride}>
                I was right
              </button>
            )}
            <button class="btn primary grow" onClick={dgNext}>
              {DG.idx + 1 < DG.items.length ? 'Next' : 'See results'}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Sweep() {
  const sw = SW!;
  const id = sw.ids[sw.idx];
  if (!id)
    return (
      <div class="box center">
        <h2>Sweep complete</h2>
        <div class="big">{sw.known}</div>
        <div class="mute small">
          marked known · {sw.learn} left to learn
        </div>
        <button class="btn primary block" style={{ marginTop: 14 }} onClick={endSweep}>
          Done
        </button>
      </div>
    );
  const w = BY[id];
  return (
    <>
      <TopLine left={`${sw.label} · ${sw.idx + 1}/${sw.ids.length}`} mid={`${sw.known} known`} onQuit={endSweep} quitLabel="Done" />
      <Prog frac={sw.idx / sw.ids.length} />
      <div class="card" role="button" tabIndex={0} style={{ minHeight: 230 }} onClick={swToggle}>
        <div class="word" lang="es">
          {w.es}
        </div>
        {sw.show ? (
          <>
            <hr />
            <div class="en">{w.en}</div>
            {w.n && <div class="note">{w.n}</div>}
          </>
        ) : (
          <div class="hint">Tap to check the meaning</div>
        )}
      </div>
      <div class="grades" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button class="g0" onClick={() => swAns(0)}>
          Learn it<small>keep as new</small>
        </button>
        <button class="g3" onClick={() => swAns(1)}>
          Know it<small>skip for now</small>
        </button>
      </div>
      <div class="row" style={{ marginTop: 10, justifyContent: 'center' }}>
        <button class="btn sm" onClick={swUndo} disabled={!sw.hist.length}>
          ↶ Undo
        </button>
        <Say text={w.es} />
      </div>
      <div class="kbd">Keys: ← learn · → know · space reveal</div>
    </>
  );
}
