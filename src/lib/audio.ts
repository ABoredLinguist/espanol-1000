// Spanish text-to-speech using the device's built-in voices, preferring Latin American accents.
let VOICES: SpeechSynthesisVoice[] = [];

function rankVoice(v: SpeechSynthesisVoice): number {
  const l = v.lang.replace('_', '-');
  if (/es-MX/i.test(l)) return 0;
  if (/es-US/i.test(l)) return 1;
  if (/es-419/i.test(l)) return 2;
  if (/es-(CO|AR|CL|PE|VE|EC|UY|GT|CR|PR|DO|BO|PY|HN|SV|NI|PA|CU)/i.test(l)) return 3;
  if (/es-ES/i.test(l)) return 8;
  return 5;
}
export function loadVoices(): SpeechSynthesisVoice[] {
  try {
    VOICES = speechSynthesis
      .getVoices()
      .filter((v) => /^es/i.test(v.lang))
      .sort((a, b) => rankVoice(a) - rankVoice(b) || Number(b.localService) - Number(a.localService));
  } catch {
    VOICES = [];
  }
  return VOICES;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  try {
    speechSynthesis.onvoiceschanged = () => loadVoices();
  } catch {
    /* ignore */
  }
}

/** Removes study notation ("+ inf.", slashes, brackets) so it reads naturally. */
export function speechText(s: string): string {
  return s
    .replace(/\+ ?(inf\.|adj\.|time|-ando\/-iendo)/g, ' ')
    .replace(/\s*\/\s*/g, ', ')
    .replace(/[()…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Holds the utterance being spoken: Safari can garbage-collect it mid-sentence otherwise.
let current: SpeechSynthesisUtterance | null = null;

/**
 * Speaks Spanish text. `onFail` runs if the device can't or won't play it
 * (no speech support, an error, or nothing starts within 2 s — e.g. iPhone Silent Mode).
 */
export function speak(s: string, voiceURI = '', rate = 0.9, onFail?: (why: string) => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onFail?.('unsupported');
    return;
  }
  try {
    const synth = speechSynthesis;
    if (!VOICES.length) loadVoices();
    // iOS drops an utterance queued right after an unnecessary cancel(), and can get stuck paused
    // after the app was in the background, so only cancel when something is playing, then resume.
    if (synth.speaking || synth.pending) synth.cancel();
    synth.resume();
    const u = new SpeechSynthesisUtterance(speechText(s));
    const v = VOICES.find((x) => x.voiceURI === voiceURI) || VOICES[0];
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else u.lang = 'es-MX';
    u.rate = rate || 0.9;
    let started = false;
    u.onstart = () => (started = true);
    u.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') onFail?.(e.error);
    };
    current = u;
    synth.speak(u);
    setTimeout(() => {
      if (!started && current === u) onFail?.('no-start');
    }, 2000);
  } catch {
    onFail?.('exception');
  }
}
