import { useEffect, useRef } from 'preact/hooks';
import { BY, W } from '../lib/data';
import { czParts, esVariants } from '../lib/check';
import { clean, pct, plural } from '../lib/utils';
import { QZ, answerQuiz, nextQ, quizOverride, quizPool, quizSetup, startQuiz, submitQuiz } from '../ui';
import { update } from '../lib/store';
import { AccentBar, Prog, Say, ScopeOptions, Seg, Tag, TopLine, WordRow, typingProps } from './common';

export function Quiz() {
  const o = QZ.opt;
  if (QZ.phase === 'setup') {
    const n = quizPool(o.scope).length;
    return (
      <div class="box">
        <h2>Quiz</h2>
        <label class="f" for="qscope">
          Words
        </label>
        <select
          id="qscope"
          value={o.scope}
          onChange={(e) => {
            o.scope = e.currentTarget.value;
            update();
          }}
        >
          <ScopeOptions
            extra={[
              ['studied', 'Words I’ve studied'],
              ['weak', 'My weak words'],
              ['all', `All ${W.length.toLocaleString()} words`],
            ]}
          />
        </select>
        <div class="mute small" style={{ marginTop: 4 }}>
          {plural(n, 'word')} in this set
        </div>
        <label class="f">Format</label>
        <Seg
          value={o.fmt}
          options={[
            ['mc', 'Choice'],
            ['typed', 'Typed'],
            ['cloze', 'Fill blank'],
            ['mix', 'Mixed'],
          ]}
          onChange={(v) => {
            o.fmt = v;
            update();
          }}
        />
        {o.fmt !== 'cloze' && (
          <>
            <label class="f">Direction</label>
            <Seg
              value={o.dir}
              options={[
                ['es', 'ES → EN'],
                ['en', 'EN → ES'],
                ['mix', 'Mixed'],
              ]}
              onChange={(v) => {
                o.dir = v;
                update();
              }}
            />
          </>
        )}
        <label class="f">Length</label>
        <Seg
          value={o.len}
          options={[
            [10, '10'],
            [20, '20'],
            [30, '30'],
            [50, '50'],
          ]}
          onChange={(v) => {
            o.len = v;
            update();
          }}
        />
        <button class="btn primary block" onClick={startQuiz} disabled={n < 1}>
          Start quiz
        </button>
        {n < 1 && o.scope === 'studied' && (
          <div class="mute small center" style={{ marginTop: 8 }}>
            You haven’t studied any words yet. Pick a tier or category instead.
          </div>
        )}
        <div class="mute small" style={{ marginTop: 10 }}>
          Words you miss are moved to today’s flashcard reviews. Typed answers forgive small typos and missing accents, and point the accents out. Fill-in-the-blank uses each word’s
          sample sentence; type the exact form that fits.
        </div>
      </div>
    );
  }

  if (QZ.phase === 'done') {
    const n = QZ.items.length;
    return (
      <>
        <div class="box center">
          <h2>Quiz results</h2>
          <div class="big">
            {QZ.score}/{n}
          </div>
          <div class="mute small">{pct(QZ.score / n)} correct</div>
        </div>
        {QZ.missed.length > 0 && (
          <div class="box">
            <h2>Missed (added to today’s reviews)</h2>
            <div class="list">
              {QZ.missed.map((id) => (
                <WordRow w={BY[id]} />
              ))}
            </div>
          </div>
        )}
        <div class="row">
          <button class="btn grow" onClick={quizSetup}>
            New quiz
          </button>
          <button class="btn primary grow" onClick={startQuiz}>
            Same settings again
          </button>
        </div>
      </>
    );
  }

  return <QuizQuestion key={QZ.idx} />;
}

function QuizQuestion() {
  const it = QZ.items[QZ.idx],
    w = BY[it.id],
    a = QZ.ans;
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!a) input.current?.focus();
  }, [a]);
  const last = QZ.idx + 1 >= QZ.items.length;

  const header = (
    <>
      <TopLine left={`Question ${QZ.idx + 1} of ${QZ.items.length}`} mid={<Tag w={w} />} onQuit={quizSetup} />
      <Prog frac={QZ.idx / QZ.items.length} />
    </>
  );
  const typedForm = (placeholder: string, lang: string | undefined, chars?: string[]) => (
    <form
      style={{ marginTop: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        submitQuiz(input.current?.value || '');
      }}
    >
      <input ref={input} {...typingProps} lang={lang} placeholder={placeholder} value={a ? a.given : undefined} disabled={!!a} aria-label="Your answer" />
      {!a && lang === 'es' && <AccentBar target={() => input.current} chars={chars} />}
      {!a && (
        <div class="row" style={{ marginTop: 6 }}>
          <button type="button" class="btn grow" onClick={() => answerQuiz(false, '', null)}>
            I don’t know
          </button>
          <button class="btn primary grow">Check</button>
        </div>
      )}
    </form>
  );
  const nextRow = (canOverride: boolean) => (
    <div class="row">
      {canOverride && (
        <button class="btn grow" onClick={quizOverride}>
          I was right
        </button>
      )}
      <button class="btn primary grow" onClick={nextQ}>
        {last ? 'See results' : 'Next'}
      </button>
    </div>
  );

  if (it.fmt === 'cloze') {
    const [pre, ans, post] = czParts(w);
    const base = !esVariants(w).has(clean(ans));
    return (
      <>
        {header}
        <div class="cz" lang="es">
          {pre}
          <u>{a ? ans : ' '.repeat(Math.max(3, ans.length))}</u>
          {post}
        </div>
        <div class="center mute small">
          {w.en}
          {base && (
            <>
              {' '}
              · a form of <b>{w.es}</b>
            </>
          )}
        </div>
        {typedForm('Missing word(s)', 'es', ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü'])}
        {a && (
          <>
            <div class={`fb ${a.ok ? 'ok' : 'no'}`}>
              <b>{a.ok ? a.note || 'Correct!' : 'Not quite.'}</b> <b>{ans}</b>
              {base && ` (${w.es})`}
              <Say text={w.s} label="Play sentence" small />
            </div>
            {nextRow(!a.ok && !!a.given)}
          </>
        )}
      </>
    );
  }

  return (
    <>
      {header}
      {it.dir === 'es' ? (
        <>
          <div class="q" lang="es">
            {w.es}
          </div>
          <div class="center">
            <Say text={w.es} />
          </div>
          <div class="center mute small">What does this mean?</div>
        </>
      ) : (
        <>
          <div class="q en">{w.en}</div>
          <div class="center mute small">Say it in Spanish · {w.t}</div>
        </>
      )}
      {it.fmt === 'mc'
        ? it.ch!.map((cid) => {
            let cls = '';
            if (a) {
              if (cid === w.id) cls = ' right';
              else if (cid === a.pick) cls = ' wrong';
            }
            return (
              <button class={`opt${cls}`} disabled={!!a} onClick={() => !QZ.ans && answerQuiz(cid === w.id, '', cid)}>
                {BY[cid][it.dir === 'es' ? 'en' : 'es']}
              </button>
            );
          })
        : typedForm(it.dir === 'es' ? 'Type the English meaning' : 'Escribe en español', it.dir === 'en' ? 'es' : undefined)}
      {a && (
        <>
          <div class={`fb ${a.ok ? 'ok' : 'no'}`}>
            <b>{a.ok ? a.note || 'Correct!' : 'Not quite.'}</b>
            <br />
            <b>{w.es}</b> — {w.en}
            {w.n && (
              <div class="mute small" style={{ marginTop: 4 }}>
                {w.n}
              </div>
            )}
            {w.s && (
              <div class="small" style={{ marginTop: 6, fontStyle: 'italic' }}>
                {w.s}
              </div>
            )}
          </div>
          {nextRow(!a.ok && it.fmt === 'typed' && !!a.given)}
        </>
      )}
    </>
  );
}
