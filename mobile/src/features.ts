// Switches for features that carry risk outside the code (medical-device rules, encryption export rules). They're set
// when the app is built, not at run time: Tidemark has no server to flip them remotely, and that's deliberate.
// Turn one off for a build with EXPO_PUBLIC_DISABLE_MEDICATION=1 or EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS=1
// (in eas.json under the build profile's "env", or in front of the command). Each must be written out in full:
// Expo only fills in EXPO_PUBLIC_ values that appear literally in the code.
import { Platform } from 'react-native';
import { opensPreview, PREVIEW_KEY, previewPass } from './core/previewKey';

const PREVIEW_HASH = process.env.EXPO_PUBLIC_WEB_PLUS_HASH;

function webPreviewOpen(hash: string | undefined): boolean {
  if (!hash || typeof window === 'undefined' || !window.location) return false;
  let store: Storage | null = null;
  try { store = window.localStorage; } catch { /* blocked */ }
  return opensPreview(previewPass(window.location.search, store), hash);
}

export const FEATURES = {
  /** The GLP-1 / medication log, dose reminders and dose history. Off hides it all; saved doses are kept. */
  medication: process.env.EXPO_PUBLIC_DISABLE_MEDICATION !== '1',
  /** Password-protected backups (the app's own encryption). Off exports plain backups only. */
  protectedBackups: process.env.EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS !== '1',
  /**
   * The web test build has every Plus feature unlocked for its owner only: nothing can be bought on the web, and it's the
   * owner's preview of the full app. It needs the passphrase whose hash the Pages workflow sets
   * (EXPO_PUBLIC_WEB_PLUS_HASH; see core/previewKey.ts). Web only, so it can never unlock the iPhone app.
   */
  webPlus: Platform.OS === 'web' && webPreviewOpen(PREVIEW_HASH),
};

/**
 * Unlocking the web preview from inside the app (Settings), for the web app added to the Home Screen: it always opens
 * on the plain address and keeps its own storage, so a passphrase given to Safari never reaches it.
 */
export const WEB_PREVIEW = {
  /** A locked web build that can be unlocked: show the Settings row. */
  offered: Platform.OS === 'web' && !!PREVIEW_HASH && !FEATURES.webPlus,
  /** Remembers the passphrase if it's right (the caller reloads the page); false if it's wrong. */
  unlock(pass: string): boolean {
    if (!opensPreview(pass.trim(), PREVIEW_HASH)) return false;
    try { window.localStorage.setItem(PREVIEW_KEY, pass.trim()); } catch { return false; }
    return true;
  },
};
