import { useEffect } from 'preact/hooks';
import { useStore, update, notice, hideNotice } from './lib/store';
import { syncLabel, sync } from './sync';
import {
  DG, QZ, SES, SW, VB, closeModal, currentTab, curWord, dgNext, flip, grade, nextQ, openModal, swAns, swToggle, ui, vbNext, type Tab,
} from './ui';
import { Home } from './views/Home';
import { Cards } from './views/Cards';
import { Quiz } from './views/Quiz';
import { Verbs } from './views/Verbs';
import { Test } from './views/Test';
import { Words } from './views/Words';
import { ModalHost } from './views/Modals';

const NAV: [Tab, string, string][] = [
  ['home', '⌂', 'Home'],
  ['cards', '❏', 'Cards'],
  ['quiz', '✎', 'Quiz'],
  ['verbs', 'ⓥ', 'Verbs'],
  ['test', '◎', 'Test'],
  ['words', '☰', 'Words'],
];
const VIEWS: Record<Tab, () => preact.JSX.Element> = { home: Home, cards: Cards, quiz: Quiz, verbs: Verbs, test: Test, words: Words };

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  if (t.matches('input,textarea,select')) return;
  if (ui.modal) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  const tab = currentTab();
  if (tab === 'cards' && SES && curWord()) {
    if (e.key === ' ') {
      e.preventDefault();
      flip();
    } else if (SES.flip && /^[1-4]$/.test(e.key)) {
      const g = +e.key - 1;
      if (SES.mode === 'practice') grade(g > 0 ? 2 : 0);
      else grade(g as 0 | 1 | 2 | 3);
    }
  } else if (tab === 'test' && SW && SW.ids[SW.idx]) {
    if (e.key === ' ') {
      e.preventDefault();
      swToggle();
    } else if (e.key === 'ArrowRight') swAns(1);
    else if (e.key === 'ArrowLeft') swAns(0);
  } else if (e.key === 'Enter') {
    if (tab === 'quiz' && QZ.phase === 'run' && QZ.ans) nextQ();
    else if (tab === 'test' && DG.phase === 'run' && DG.ans) dgNext();
    else if (tab === 'verbs' && VB.phase === 'run' && VB.checked) vbNext();
  }
}

export function App() {
  useStore();
  const tab = currentTab();
  useEffect(() => {
    const onHash = () => {
      update();
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  const View = VIEWS[tab];
  return (
    <>
      <header>
        <h1>
          <small>Top 1000 · Latin American</small>Español 1000
        </h1>
        <span class={`pill${sync.status === 'synced' ? ' ok' : ''}`} aria-live="polite">
          {syncLabel()}
        </span>
        <button class="iconbtn" aria-label="Settings" onClick={() => openModal({ kind: 'settings' })}>
          ⚙︎
        </button>
      </header>
      <main>
        <View />
      </main>
      <nav aria-label="Sections">
        {NAV.map(([k, icon, label]) => (
          <a href={`#${k}`} class={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>
            <b aria-hidden="true">{icon}</b>
            {label}
          </a>
        ))}
      </nav>
      {notice.text && (
        <div class="notice" role="status" onClick={hideNotice}>
          {notice.text}
        </div>
      )}
      <ModalHost />
    </>
  );
}
