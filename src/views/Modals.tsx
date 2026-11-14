import { useEffect, useRef, useState } from 'preact/hooks';
import { BY, PERSONS, TENSES, TENSE_KEYS, TIER, TIER_COUNTS, VBY, VNOTE, W } from '../lib/data';
import { loadVoices } from '../lib/audio';
import { placedCard, dueTodayCard } from '../lib/schedule';
import { decodeBackup, encodeBackup, fresh, mergeState } from '../lib/state';
import { S, replaceState, save, saveSettings, speak, status, vbKnown, vbLevel } from '../lib/store';
import { fmtIv, today } from '../lib/utils';
import { closeModal, resetScreens, ui, vbDrill } from '../ui';
import { signIn, signOut, sync, syncLabel } from '../sync';
import { Example, Say, ScopeOptions, Seg, Tag } from './common';

export function ModalHost() {
  const m = ui.modal;
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (m) sheet.current?.focus();
  }, [m?.kind]);
  if (!m) return null;
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
      <div class="sheet" role="dialog" aria-modal="true" tabIndex={-1} ref={sheet}>
        {m.kind === 'settings' && <Settings />}
        {m.kind === 'word' && <WordDetail id={m.id} />}
        {m.kind === 'verb' && <VerbRef v={m.v} />}
      </div>
    </div>
  );
}

function Hd({ children }: { children: preact.ComponentChildren }) {
  return (
    <div class="hd">
      <h3>{children}</h3>
      <button class="iconbtn" aria-label="Close" onClick={closeModal}>
        ✕
      </button>
    </div>
  );
}

function WordDetail({ id }: { id: string }) {
  const w = BY[id],
    c = S.cards[id],
    st = status(id),
    q = S.q[id] || [0, 0],
    t = today();
  const stTxt =
    st === 'new' || !c
      ? 'New, not studied yet'
      : `${st === 'mastered' ? 'Mastered' : 'Learning'} · next review ${c.due <= t ? 'today' : 'in ' + fmtIv(c.due - t)}${c.placed ? ' (marked known)' : ''}`;
  return (
    <>
      <Hd>
        <Tag w={w} /> {TIER[w.k]}
      </Hd>
      <div class="center">
        <div class="q" style={{ marginTop: 4 }} lang="es">
          {w.es}
        </div>
        <Say text={w.es} />
        <div class="en" style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>
          {w.en}
        </div>
        {w.n && (
          <div class="mute small" style={{ marginTop: 6 }}>
            {w.n}
          </div>
        )}
        <Example w={w} />
        <div class="mute small" style={{ marginTop: 8 }}>
          {w.t} · {w.c}
        </div>
      </div>
      <div class="box" style={{ marginTop: 14 }}>
        <div class="small">{stTxt}</div>
        <div class="small mute">
          Quiz record: {q[0]} right · {q[1]} wrong{c ? ` · lapses ${c.lapses}` : ''}
        </div>
      </div>
      <div class="row wrap">
        {st !== 'mastered' && (
          <button
            class="btn grow"
            onClick={() => {
              S.cards[id] = placedCard();
              save();
            }}
          >
            Mark known
          </button>
        )}
        <button
          class="btn grow"
          onClick={() => {
            S.cards[id] = dueTodayCard(S.cards[id]);
            save();
          }}
        >
          Review today
        </button>
        {c && (
          <button
            class="btn grow danger"
            onClick={() => {
              delete S.cards[id];
              delete S.q[id];
              save();
            }}
          >
            Reset
          </button>
        )}
      </div>
    </>
  );
}

function VerbRef({ v }: { v: string }) {
  const vb = VBY[v];
  const open = TENSE_KEYS.filter((t) => vbLevel(v, t) !== 3).map((t) => TENSES[t]);
  return (
    <>
      <Hd>
        <span lang="es">{vb.v}</span> <span class="mute small">{vb.en}</span>
      </Hd>
      <div class="row" style={{ marginBottom: 8 }}>
        <span class="tag">{vb.k}</span>
        <span class={`small ${vbKnown(v) ? '' : 'mute'}`}>{vbKnown(v) ? '✓ Fully known' : `Not fully known yet: ${open.join(', ')} still open`}</span>
      </div>
      {VNOTE[v] && (
        <div class="small mute" style={{ marginBottom: 8 }}>
          {VNOTE[v]}
        </div>
      )}
      <table class="reftab" lang="es">
        <thead>
          <tr>
            <th />
            {TENSE_KEYS.map((t) => (
              <th>{TENSES[t]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERSONS.map((p, i) => (
            <tr>
              <td class="mute">{p}</td>
              {TENSE_KEYS.map((t) => (
                <td>{vb.f[t][i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button class="btn primary block" style={{ marginTop: 14 }} onClick={() => vbDrill(v)}>
        Drill this verb
      </button>
    </>
  );
}

function Settings() {
  const s = S.set;
  const [voices, setVoices] = useState(loadVoices());
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [armed, setArmed] = useState(false);
  const [email, setEmail] = useState('');
  const restoreRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = setTimeout(() => setVoices(loadVoices()), 400);
    return () => clearTimeout(t);
  }, []);
  const setS = (patch: Partial<typeof s>) => {
    Object.assign(S.set, patch);
    saveSettings();
  };

  return (
    <>
      <Hd>Settings</Hd>

      <label class="f">Account sync</label>
      {!sync.enabled ? (
        <div class="small mute">Sync isn't set up for this copy of the app. Progress saves on this device; use a backup code to move it.</div>
      ) : sync.email ? (
        <>
          <div class="small">
            Signed in as <b>{sync.email}</b> · {syncLabel()}
          </div>
          <button class="btn sm" style={{ marginTop: 6 }} onClick={() => void signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <div class="small mute">Sign in with your email to sync progress between your phone and computer. No password needed.</div>
          <form
            class="signin"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes('@')) void signIn(email.trim());
            }}
          >
            <input type="email" placeholder="you@example.com" aria-label="Email" value={email} onInput={(e) => setEmail(e.currentTarget.value)} autocomplete="email" />
            <button class="btn sm primary">Send link</button>
          </form>
        </>
      )}
      {sync.message && (
        <div class="small mute" style={{ marginTop: 6 }}>
          {sync.message}
        </div>
      )}

      <label class="f" for="scope">
        Flashcard scope
      </label>
      <select id="scope" value={s.scope} onChange={(e) => setS({ scope: e.currentTarget.value })}>
        <ScopeOptions extra={[['all', 'Everything, in study order']]} />
      </select>
      <label class="f">New words per day</label>
      <Seg value={s.newPer} options={[5, 10, 15, 20, 30, 50].map((n): [number, string] => [n, String(n)])} onChange={(v) => setS({ newPer: v })} />
      <label class="f">Card direction</label>
      <Seg
        value={s.dir}
        options={[
          ['es', 'ES → EN'],
          ['en', 'EN → ES'],
          ['mix', 'Mixed'],
        ]}
        onChange={(v) => setS({ dir: v })}
      />
      <div class="toggle">
        <span id="autolbl">Play Spanish audio automatically</span>
        <button class={`sw ${s.auto ? 'on' : ''}`} role="switch" aria-checked={s.auto} aria-labelledby="autolbl" onClick={() => setS({ auto: !s.auto })} />
      </div>
      <label class="f" for="voice">
        Voice
      </label>
      {voices.length ? (
        <select
          id="voice"
          value={s.voice || voices[0].voiceURI}
          onChange={(e) => {
            setS({ voice: e.currentTarget.value });
            speak('Hola');
          }}
        >
          {voices.map((v) => (
            <option value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      ) : (
        <div class="small mute">
          No Spanish voice found yet. On iPhone, go to Settings → Accessibility → Spoken Content → Voices → Spanish to download one (Mexico or US gives you a Latin American accent).
        </div>
      )}
      <label class="f">Speech speed</label>
      <Seg
        value={s.rate}
        options={[
          [0.7, 'Slow'],
          [0.9, 'Normal'],
          [1.05, 'Fast'],
        ]}
        onChange={(v) => setS({ rate: v })}
      />
      <div class="row">
        <button class="btn sm" onClick={() => speak('Hola, ¿cómo estás? Vamos a practicar español.')}>
          🔊 Test voice
        </button>
      </div>

      <label class="f">Backup</label>
      <div class="small mute" style={{ marginBottom: 6 }}>
        A backup code is a manual copy of your progress. Codes from the original claude.ai version work here too.
      </div>
      <div class="row">
        <button
          class="btn sm grow"
          onClick={async () => {
            const c = encodeBackup(S);
            try {
              await navigator.clipboard.writeText(c);
              setMsg('Backup code copied. Paste it into Notes or an email to yourself.');
            } catch {
              setCode(c);
              setMsg('Couldn’t copy automatically. Select the code above and copy it.');
            }
          }}
        >
          Copy backup code
        </button>
        <button class="btn sm grow" onClick={() => setRestoring(true)}>
          Restore from code
        </button>
      </div>
      {code && <textarea rows={4} readOnly style={{ marginTop: 8, fontSize: 12 }} value={code} />}
      {restoring && (
        <>
          <textarea ref={restoreRef} rows={4} placeholder="Paste your backup code" aria-label="Backup code" style={{ marginTop: 8, fontSize: 12 }} />
          <button
            class="btn sm primary"
            style={{ marginTop: 6 }}
            onClick={() => {
              try {
                const o = decodeBackup(restoreRef.current?.value || '');
                o.epoch = S.epoch; // merge rather than replace
                const merged = mergeState(S, o);
                merged.set = { ...fresh().set, ...merged.set };
                replaceState(merged);
                save();
                setRestoring(false);
                setMsg('Restored. The backup was merged with your current progress.');
              } catch {
                setMsg('That code didn’t work. Check that you pasted all of it.');
              }
            }}
          >
            Restore and merge
          </button>
        </>
      )}
      {msg && (
        <div class="small mute" style={{ marginTop: 6 }}>
          {msg}
        </div>
      )}

      <label class="f">Danger zone</label>
      <button
        class="btn sm danger"
        onClick={() => {
          if (!armed) return setArmed(true);
          const keep = S.set;
          const next = fresh();
          next.set = keep;
          replaceState(next);
          resetScreens();
          save();
          closeModal();
        }}
      >
        {armed ? 'Tap again to erase all progress' : 'Reset all progress'}
      </button>
      {armed && sync.email && <div class="small danger" style={{ marginTop: 4 }}>This also erases it from your account and your other devices.</div>}

      <div class="small mute" style={{ marginTop: 14 }}>
        {W.length.toLocaleString()} entries: {TIER_COUNTS}.
      </div>
    </>
  );
}

