// Account sync through Supabase. Progress always saves on the device first;
// when signed in it is merged with the copy in the account (same rules as mergeState).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { S, onSave, replaceState, saveLocal, update } from './lib/store';
import { mergeState, normalize } from './lib/state';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const sync = {
  enabled: !!(URL && KEY),
  /** 'local' | 'busy' | 'synced' | 'offline' */
  status: 'local' as 'local' | 'busy' | 'synced' | 'offline',
  email: null as string | null,
  message: '',
};
export function syncLabel(): string {
  return { local: 'On this device', busy: 'Syncing…', synced: 'Synced', offline: 'Offline · saved here' }[sync.status];
}

let sb: SupabaseClient | null = null;
let uid: string | null = null;
let last: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false,
  again = false;

function set(st: typeof sync.status) {
  sync.status = st;
  update();
}

async function pull(): Promise<void> {
  if (!sb || !uid) return;
  try {
    const { data, error } = await sb.from('progress').select('state').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    if (data?.state) {
      const remote = normalize(data.state);
      const before = JSON.stringify(S);
      const merged = mergeState(S, remote);
      last = JSON.stringify(remote);
      // In-progress screens keep their own state, so re-rendering mid-question is safe.
      if (JSON.stringify(merged) !== before) replaceState(merged, true);
    }
    if (JSON.stringify(S) !== last) await push();
    else set('synced');
  } catch {
    set('offline');
  }
}

async function push(): Promise<void> {
  if (!sb || !uid) return;
  if (busy) {
    again = true;
    return;
  }
  const s = JSON.stringify(S);
  if (s === last) return set('synced');
  busy = true;
  set('busy');
  try {
    const { error } = await sb.from('progress').upsert({ user_id: uid, state: S, updated_at: new Date().toISOString() });
    if (error) throw error;
    last = s;
    set('synced');
  } catch {
    set('offline');
  }
  busy = false;
  if (again) {
    again = false;
    void push();
  }
}

function onSession(id: string | null, email: string | null) {
  const changed = id !== uid;
  uid = id;
  sync.email = email;
  if (!id) {
    last = null;
    return set('local');
  }
  if (changed) {
    set('busy');
    void pull();
  }
}

export function initSync(): void {
  if (!sync.enabled) return;
  sb = createClient(URL!, KEY!, { auth: { persistSession: true, detectSessionInUrl: true } });
  sb.auth.getSession().then(({ data }) => onSession(data.session?.user.id ?? null, data.session?.user.email ?? null));
  sb.auth.onAuthStateChange((_e, session) => onSession(session?.user.id ?? null, session?.user.email ?? null));
  onSave(() => {
    if (!uid) return;
    clearTimeout(timer);
    timer = setTimeout(() => void push(), 3000);
  });
  document.addEventListener('visibilitychange', () => {
    if (!uid) return;
    if (document.visibilityState === 'hidden') {
      clearTimeout(timer);
      void push();
    } else void pull();
  });
  window.addEventListener('online', () => uid && void pull());
}

/** Emails a one-time sign-in link. */
export async function signIn(email: string): Promise<void> {
  if (!sb) return;
  sync.message = 'Sending…';
  update();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  sync.message = error ? `Couldn’t send the link: ${error.message}` : `Check ${email} for a sign-in link. Open it on this device.`;
  update();
}
export async function signOut(): Promise<void> {
  if (!sb) return;
  clearTimeout(timer);
  await push();
  await sb.auth.signOut();
  sync.message = 'Signed out. Your progress stays on this device.';
  saveLocal();
  update();
}
