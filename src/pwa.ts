// Install prompt (Chrome/Edge/Android) and service-worker registration.
import { registerSW } from 'virtual:pwa-register';
import { update } from './lib/store';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export const installPrompt: { value: BeforeInstallPromptEvent | null } = { value: null };

export function initPwa(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt.value = e as BeforeInstallPromptEvent;
    update();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt.value = null;
    update();
  });
  // New versions install in the background and take over on the next launch.
  registerSW({ immediate: true });
}

export async function promptInstall(): Promise<void> {
  const p = installPrompt.value;
  if (!p) return;
  await p.prompt();
  await p.userChoice;
  installPrompt.value = null;
  update();
}
