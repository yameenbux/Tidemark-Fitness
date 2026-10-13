import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const SUPPORT_EMAIL = 'support@ysbdesigns.uk';
export const PRIVACY_URL = 'https://tidemark.ysbdesigns.uk/privacy.html';
/**
 * The app's numeric App Store ID (App Store Connect → the app → App Information → Apple ID). It only exists once the
 * app has been created there; until it's filled in, Settings has no "Rate Tidemark" row rather than a broken one.
 */
export const APP_STORE_ID: string | null = '6822237050';
/** Apple's standard licence agreement, which Tidemark uses as its terms of use (linked from the paywall, as Apple requires). */
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/** The version people see ("1.2.0"), without the build number. */
export const marketingVersion = () => Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';

export const appVersion = () => {
  const v = marketingVersion();
  const b = Application.nativeBuildVersion ?? Constants.expoConfig?.ios?.buildNumber;
  return b ? `${v} (${b})` : v;
};

/**
 * Error text can quote what was being handled (a weight, a habit name), so only its shape is kept: quoted strings become
 * "…" (an apostrophe inside a word doesn't start one), numbers become #, and it is capped.
 */
export function scrub(text: string, max = 300): string {
  return text.replace(/(^|\W)(["'`])(?:(?!\2)[^\\\n]|\\.)*\2/g, '$1"…"').replace(/\d+(?:[.,]\d+)*/g, '#').slice(0, max);
}

/**
 * A crash report the person sends themselves, by email, after reading it: the error, where it happened in the app's
 * code, the app version and the phone's OS. Never any weights, habits or other data. Tidemark has no crash-reporting
 * service: that would send data off the phone, and the App Store listing says no data is collected.
 */
export function errorReportUrl(error: Error, componentStack?: string | null): string {
  const where = (componentStack ?? '').split('\n').map(l => scrub(l.trim(), 120)).filter(Boolean).slice(0, 6).join('\n');
  const body = [
    'What were you doing when this happened? (optional)', '', '',
    '--- Details for support (no personal data) ---',
    `Tidemark ${appVersion()} · ${Platform.OS} ${String(Platform.Version)}`,
    `${String(error.name).slice(0, 60)}: ${scrub(String(error.message))}`,
    ...(where ? [`In:\n${where}`] : []),
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Tidemark error report ${appVersion()}`)}&body=${encodeURIComponent(body)}`;
}
