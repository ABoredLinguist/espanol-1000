import { S, dueCount, newAvailable, saveSettings, scopeLabel } from '../lib/store';
import { sched, type G } from '../lib/schedule';
import { fmtIv } from '../lib/utils';
import { SES, curWord, endSession, flip, grade, startStudy, studyExtra } from '../ui';
import { Example, Prog, Say, Seg, Tag, TopLine } from './common';

export function Cards() {
  if (!SES) {
    const due = dueCount(),
      nl = newAvailable();
    return (
      <div class="box center">
        <h2>Flashcards</h2>
        <div class="big">{due + nl}</div>
        <div class="mute small" style={{ marginBottom: 14 }}>
          {due} due · {nl} new · {scopeLabel(S.set.scope)}
        </div>
        {due + nl ? (
          <button class="btn primary block" onClick={startStudy}>
            Start session
          </button>
        ) : (
          <div class="mute small" style={{ marginBottom: 10 }}>
            You're done for today. ¡Bien hecho!
          </div>
        )}
        <button class="btn block" style={{ marginTop: 8 }} onClick={studyExtra}>
          Learn 10 extra new words
        </button>
        <div style={{ marginTop: 14 }}>
          <Seg
            value={S.set.dir}
            options={[
              ['es', 'ES → EN'],
              ['en', 'EN → ES'],
              ['mix', 'Mixed'],
            ]}
            onChange={(v) => {
              S.set.dir = v;
              saveSettings();
            }}
          />
        </div>
        <div class="mute small">New words come in this order: Critical → Phrases → High → Medium → Core by rank.</div>
      </div>
    );
  }

  const w = curWord();
  if (!w) {
    return (
      <div class="box center">
        <h2>Session complete</h2>
        <div class="big">{SES.done}</div>
        <div class="mute small">
          cards reviewed{SES.again ? ` · ${SES.again} repeated` : ''}
        </div>
        {SES.mode === 'practice' && (
          <div class="mute small" style={{ marginTop: 6 }}>
            Practice mode: your schedule wasn't changed.
          </div>
        )}
        <button class="btn primary block" style={{ marginTop: 14 }} onClick={endSession}>
          Done
        </button>
      </div>
    );
  }

  const dir = SES.dirs[w.id],
    c = S.cards[w.id];
  const isNew = !c && !SES.newSeen.has(w.id);
  const left = SES.queue.length;
  const spanish = (
    <>
      <div class="word" lang="es">
        {w.es}
      </div>
      <Say text={w.es} />
    </>
  );
  const english = <div class="en">{w.en}</div>;

  return (
    <>
      <TopLine
        left={`${SES.mode === 'practice' ? 'Practice' : 'Review'} · ${left} left`}
        mid={
          <>
            {isNew && <span class="tag C">NEW</span>} <Tag w={w} />
          </>
        }
        onQuit={endSession}
        quitLabel="End"
      />
      <Prog frac={SES.done / (SES.done + left)} />
      <div class="card" role="button" tabIndex={0} aria-label={SES.flip ? 'Card' : 'Show answer'} onClick={flip}>
        {dir === 'es' ? (
          spanish
        ) : (
          <>
            {english}
            <div class="mute small" style={{ marginTop: 6 }}>
              {w.t}
            </div>
          </>
        )}
        {SES.flip && (
          <>
            <hr />
            {dir === 'es' ? english : spanish}
            {w.n && <div class="note">{w.n}</div>}
            <Example w={w} />
            <div class="note" style={{ marginTop: 8 }}>
              {w.t} · {w.c}
            </div>
          </>
        )}
        {!SES.flip && <div class="hint">Tap to show answer</div>}
      </div>
      {SES.flip ? (
        <>
          {SES.mode === 'practice' ? (
            <div class="grades" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button class="g0" onClick={() => grade(0)}>
                Again<small>see it again</small>
              </button>
              <button class="g2" onClick={() => grade(2)}>
                Got it<small>next</small>
              </button>
            </div>
          ) : (
            <div class="grades">
              {(['Again', 'Hard', 'Good', 'Easy'] as const).map((n, g) => (
                <button class={`g${g}`} onClick={() => grade(g as G)}>
                  {n}
                  <small>{g === 0 ? 'again' : fmtIv(sched(c, g as G, false).iv)}</small>
                </button>
              ))}
            </div>
          )}
          <div class="kbd">Keys: 1–4 to grade · space to flip</div>
        </>
      ) : (
        <>
          <button class="btn block" style={{ marginTop: 14 }} onClick={flip}>
            Show answer
          </button>
          <div class="kbd">Space to flip</div>
        </>
      )}
    </>
  );
}
