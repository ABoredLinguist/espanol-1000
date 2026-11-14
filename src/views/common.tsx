import type { ComponentChildren, RefObject } from 'preact';
import { CATS, TIER, TIER_ORDER, type Word } from '../lib/data';
import { speak, status } from '../lib/store';
import { openModal } from '../ui';

export function Tag({ w }: { w: Word }) {
  return <span class={`tag ${w.k}`}>{w.k === 'R' ? '#' + w.id.slice(1) : w.id}</span>;
}

export function Say({ text, label = 'Play audio', small }: { text: string; label?: string; small?: boolean }) {
  return (
    <button
      type="button"
      class="say"
      aria-label={label}
      style={small ? { width: 30, height: 30, fontSize: 13, margin: '0 0 0 6px', verticalAlign: 'middle' } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
    >
      🔊
    </button>
  );
}

export function Example({ w }: { w: Word }) {
  if (!w.s) return null;
  return (
    <div class="ex">
      <span>{w.s}</span>
      <Say text={w.s} label="Play sentence" />
    </div>
  );
}

export function WordRow({ w }: { w: Word }) {
  return (
    <button type="button" class="it" onClick={() => openModal({ kind: 'word', id: w.id })}>
      <span class={`dot ${status(w.id)}`} aria-label={status(w.id)} />
      <span class="es">{w.es}</span>
      <span class="gl">{w.en}</span>
    </button>
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="radiogroup">
      {options.map(([v, l]) => (
        <button type="button" role="radio" aria-checked={value === v} class={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Buttons that insert accented letters at the cursor of the given input. */
export function AccentBar({ target, chars = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'] }: { target: () => HTMLInputElement | null; chars?: string[] }) {
  return (
    <div class="acc">
      {chars.map((c) => (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const i = target();
            if (!i) return;
            const p = i.selectionStart ?? i.value.length;
            i.value = i.value.slice(0, p) + c + i.value.slice(i.selectionEnd ?? p);
            i.focus();
            i.setSelectionRange(p + 1, p + 1);
          }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function ScopeOptions({ extra }: { extra: [string, string][] }) {
  return (
    <>
      {extra.map(([v, l]) => (
        <option value={v}>{l}</option>
      ))}
      <optgroup label="Tiers">
        {TIER_ORDER.map((k) => (
          <option value={k}>{TIER[k]}</option>
        ))}
      </optgroup>
      <optgroup label="Categories">
        {CATS.map((c) => (
          <option value={c}>{c}</option>
        ))}
      </optgroup>
    </>
  );
}

export function TopLine({ left, mid, onQuit, quitLabel = 'Quit' }: { left: ComponentChildren; mid?: ComponentChildren; onQuit: () => void; quitLabel?: string }) {
  return (
    <div class="topline">
      <span>{left}</span>
      <span>{mid}</span>
      <button type="button" class="linkbtn" onClick={onQuit}>
        {quitLabel}
      </button>
    </div>
  );
}

export function Prog({ frac }: { frac: number }) {
  return (
    <div class="prog" role="progressbar" aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${frac * 100}%` }} />
    </div>
  );
}

export const typingProps = {
  type: 'text',
  autocomplete: 'off',
  autocapitalize: 'off',
  autocorrect: 'off',
  spellcheck: false,
} as const;

export type InputRef = RefObject<HTMLInputElement>;
