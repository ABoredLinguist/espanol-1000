import { BY, TIER, TIER_ORDER } from '../lib/data';
import { S, counts, dueCount, newAvailable, saveSettings, scopeLabel, streak, vbKnownCount, weakList } from '../lib/store';
import { DAYMS, pct, plural, today } from '../lib/utils';
import { drillWeak, go, openModal, startStudy } from '../ui';
import { WordRow } from './common';
import { installPrompt, promptInstall } from '../pwa';

export function Home() {
  const t = today(),
    all = counts();
  const due = dueCount(),
    nl = newAvailable();
  const fc = [0, 0, 0, 0, 0, 0, 0];
  Object.values(S.cards).forEach((c) => {
    const k = Math.max(0, c.due - t);
    if (k < 7) fc[k]++;
  });
  const fmax = Math.max(1, ...fc);
  const dn = ['Today', ...[1, 2, 3, 4, 5, 6].map((k) => new Date(Date.now() + k * DAYMS).toLocaleDateString(undefined, { weekday: 'short' }))];
  const weak = weakList(8);
  const last = S.diag[S.diag.length - 1];
  const placed = Object.values(S.cards).filter((c) => c.placed).length;
  const vk = vbKnownCount();
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

  return (
    <>
      {!S.set.hideInstall && !standalone && (
        <div class="box">
          <div class="row">
            <div class="grow small">
              {installPrompt.value ? (
                <>
                  <b>Install Español 1000</b> so it opens like an app and works offline.
                </>
              ) : (
                <>
                  <b>Put this on your Home Screen:</b> in Safari tap <b>Share</b> ⎋, then <b>Add to Home Screen</b>. It works offline after that.
                </>
              )}
            </div>
            {installPrompt.value && (
              <button class="btn sm primary" onClick={promptInstall}>
                Install
              </button>
            )}
            <button
              class="btn sm"
              onClick={() => {
                S.set.hideInstall = true;
                saveSettings();
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div class="box">
        <h2>Today</h2>
        <div class="row">
          <div class="grow">
            <div class="big">{due + nl}</div>
            <div class="mute small">
              {plural(due, 'review')} due · {nl} new
            </div>
          </div>
          <button class="btn primary" onClick={startStudy}>
            {due + nl ? 'Study now' : 'Learn 10 more'}
          </button>
        </div>
        <div class="mute small" style={{ marginTop: 8 }}>
          Scope: {scopeLabel(S.set.scope)} ·{' '}
          <button class="linkbtn acc" onClick={() => openModal({ kind: 'settings' })}>
            change
          </button>
        </div>
      </div>

      <div class="stats" style={{ marginBottom: 12 }}>
        <div class="stat">
          <b>{streak()}</b>
          <span>day streak</span>
        </div>
        <div class="stat">
          <b>{S.log[t] || 0}</b>
          <span>reviewed today</span>
        </div>
        <div class="stat">
          <b>{pct((all.m + all.l * 0.5) / all.t)}</b>
          <span>list progress</span>
        </div>
      </div>

      <button class="box boxbtn" onClick={() => go('verbs')}>
        <div class="row">
          <div class="grow">
            <h2 style={{ margin: '0 0 4px' }}>Verbs fully known</h2>
            <div class="bar">
              <i class="m" style={{ width: `${vk}%` }} />
            </div>
          </div>
          <div class="big" style={{ marginLeft: 10 }}>
            {vk}
            <span class="mute" style={{ fontSize: 16 }}>
              /100
            </span>
          </div>
        </div>
      </button>

      <div class="box">
        <h2>Progress by tier</h2>
        {TIER_ORDER.map((k) => {
          const c = counts((w) => w.k === k);
          return (
            <div class="tierrow">
              <span>{TIER[k]}</span>
              <div class="bar">
                <i class="m" style={{ width: `${(c.m / c.t) * 100}%` }} />
                <i class="l" style={{ width: `${(c.l / c.t) * 100}%` }} />
              </div>
              <span class="mute" style={{ textAlign: 'right' }}>
                {c.m + c.l}/{c.t}
              </span>
            </div>
          );
        })}
        <div class="legend">
          <span>
            <i style={{ background: 'var(--teal)' }} />
            Mastered {all.m}
          </span>
          <span>
            <i style={{ background: 'var(--warn)' }} />
            Learning {all.l}
          </span>
          <span>
            <i style={{ background: 'var(--line)' }} />
            New {all.n}
          </span>
        </div>
        {placed > 0 && (
          <div class="mute small" style={{ marginTop: 6 }}>
            {plural(placed, 'word')} marked known from the placement test. Each one gets checked once later.
          </div>
        )}
      </div>

      <div class="box">
        <h2>Reviews coming up</h2>
        <div class="fc">
          {fc.map((n, k) => (
            <div>
              <b>{n || ''}</b>
              <i style={{ height: `${(n / fmax) * 60}px` }} />
              {dn[k]}
            </div>
          ))}
        </div>
      </div>

      <div class="box">
        <h2>Vocabulary coverage</h2>
        {last ? (
          <>
            <div class="row">
              <div class="grow">
                <div class="big">{pct(last.cov)}</div>
                <div class="mute small">estimated, from the placement test on {new Date(last.t).toLocaleDateString()}</div>
              </div>
              <button class="btn sm" onClick={() => go('test')}>
                Retest
              </button>
            </div>
            {S.diag.length > 1 && (
              <div class="mute small" style={{ marginTop: 8 }}>
                History:{' '}
                {S.diag
                  .slice(-6)
                  .map((d) => new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + pct(d.cov))
                  .join(' → ')}
              </div>
            )}
          </>
        ) : (
          <div class="row">
            <div class="grow small mute">Take the 10-minute placement test to estimate your coverage and skip words you already know.</div>
            <button class="btn sm teal" onClick={() => go('test')}>
              Start
            </button>
          </div>
        )}
      </div>

      <div class="box">
        <h2>Weak words</h2>
        {weak.length ? (
          <>
            <div class="list">
              {weak.map((id) => (
                <WordRow w={BY[id]} />
              ))}
            </div>
            <button class="btn block" style={{ marginTop: 10 }} onClick={drillWeak}>
              Practice weak words
            </button>
          </>
        ) : (
          <div class="mute small">Words you miss in reviews or quizzes will show up here.</div>
        )}
      </div>
    </>
  );
}
