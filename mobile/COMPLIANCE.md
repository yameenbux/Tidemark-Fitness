# Compliance checklist

Checked against what Tidemark actually does on 8 October 2026: local-only, no account, no server, no analytics, no ads.
The only network traffic is Apple's own: StoreKit, when someone buys, restores or the app checks Plus. Re-check this list
if any of that changes (an account, a server, an SDK).

| Item | Needed? | Why | What exists |
|---|---|---|---|
| Delete account | **No account exists** | App Store guideline 5.1.1(v) applies to apps that let people create an account. Tidemark has none. | Settings → **Delete all my data** erases everything (plan, weigh-ins, habits, measurements, photos, preferences, reminders, cached files) after two confirmations. The privacy policy explains there's nothing held elsewhere. |
| Restore purchases | **Yes** (Tidemark Plus is sold) | Required for subscriptions and non-consumables (guideline 3.1.1). | "Restore purchases" in Settings → Tidemark Plus and on the paywall. Plus found with Apple on launch (a reinstall, a new iPhone) is unlocked without asking. |
| Subscription screen terms | **Yes** | Guideline 3.1.2: price and period, auto-renewal, how to cancel, links to terms of use and privacy policy, before purchase. | The paywall shows Apple's own localised prices, the trial and renewal terms, and links to Apple's standard EULA (the terms of use) and `privacy.html`; "Manage subscription" opens Apple's page. Put the same EULA link in the App Store description. |
| Privacy policy | **Yes** (required for every app) | | `privacy.html` at the repo root, served at `https://tidemark.ysbdesigns.uk/privacy.html` (the old `yameenbux.github.io/Tracker/privacy.html` redirects there) and linked from Settings → About. Includes support email, data protection, deletion, children and a not-medical-advice note. |
| Terms of service | **No** | Apple's Standard EULA applies to every App Store app that doesn't supply its own. There are no accounts, payments or user content to govern. The not-medical-advice wording sits in the app and the privacy policy. | Not added. In App Store Connect, leave the licence agreement as Apple's standard EULA. |
| Refund policy | **No** | App Store refunds are handled by Apple, never by the developer; a refunded purchase loses Plus at the next check. | Not added. |
| Cookie policy | **No** | The app has no web views and sets no cookies. The privacy page sets none and loads nothing from third parties (no Google Fonts, no analytics; GitHub Pages sets no cookies). | Not added. |
| Cookie consent banner | **No** | There are no cookies or trackers to consent to (UK PECR / ePrivacy only apply when something is stored on or read from the visitor's device beyond what's strictly necessary). | Not added. Adding one with nothing behind it would be misleading. |
| Form consents | **No consent boxes needed** | Nothing a person types leaves their phone, so there's no processing by us that would need consent. Each iOS permission is asked for only at the moment it's used, with a plain reason. | Camera (progress photos), Photos (pick a progress photo), Face ID (optional lock) and Notifications (optional reminder): each with a usage string, each optional. No microphone, location, contacts, tracking or advertising ID. |
| Don't collect unnecessary data | **Done** | Tidemark stores only what the person enters, on their phone. Optional features (photos, measurements, calories, sessions, meals) stay empty unless used. No device identifiers, no logs, no analytics. | App Privacy answer in App Store Connect: **Data Not Collected**. |
| Audit third-party SDKs | **Done** (below) | | |
| Export compliance (encryption) | **Answered per build in TestFlight; one form needed for France** | Password-protected backups use XChaCha20-Poly1305 and scrypt from @noble: industry-standard algorithms, but not Apple's. Apple's table (App Store Connect Help → Export compliance documentation for encryption) says that needs a **French encryption declaration** if the app is on sale in France, and nothing else. | The build makes **no** encryption claim in Info.plist (`app.config.js` removes `usesNonExemptEncryption`). Declaring `ITSAppUsesNonExemptEncryption = YES` without an approved compliance code got build 1 rejected at upload (ITMS-90592). So each build arrives as "Missing Compliance" in TestFlight. Answer there: uses encryption → yes; standard algorithms, not Apple's → yes; available in France → **no**, until the French declaration is approved. Leave France out of the app's availability until then. Once the answers give "No documentation required", or documentation is approved and App Store Connect shows its code, set the key in `app.config.js` (and `ITSEncryptionExportComplianceCode` if there's a code) so the questions stop. |
| In-app purchases submitted with the build | **Yes, on the first submission** | Guideline 2.1: the three Plus products must be attached to the version and "Ready to Submit". If they aren't, the paywall can't load prices and shows "The App Store couldn't be reached", which reviewers reject as incomplete. | Monthly and yearly must be in **one** subscription group, or trial eligibility and switching between them break. Each product needs a review screenshot of the paywall. |
| Health data and iCloud | **Handled** | Guideline 5.1.3(ii): an app may not store personal health information in iCloud. | The app never syncs to iCloud. Automatic backups can go to a folder the person picks, which may be in iCloud Drive, so they leave out every reading that came from Apple Health (`withoutHealth`, tested); restoring reads Health again. Settings no longer suggests iCloud Drive. A backup the person exports by hand from the share sheet still includes Health readings: it's their own copy, sent where they choose. The Health permission text and `privacy.html` say the same. iPhone device backups are the system's, not the app's. Mention all of this in the App Review notes. |
| Age rating | **Answer truthfully** | The medication log covers prescription treatment such as GLP-1 injections. | In the age rating questions, answer "Medical/Treatment information" as infrequent. Expect 12+ or higher. The medication placeholder uses no brand names. |
| Medical-device / medical-claims rules | **Kept out of scope** | The optional medication tracker only records what the person enters (name, dose, schedule, doses taken) and shows trend changes next to it. It never suggests, calculates or changes a dose, so it stays a log rather than a medical device (UK MHRA / EU MDR software guidance; App Store guideline 1.4.1). | Copy on the medication page and card says it's a record, not advice. **Don't add dose suggestions or titration advice** without regulatory advice first. Dose-day reminders don't name the medication on the lock screen. |

## Third-party SDK audit

Every runtime dependency, what it does, and whether it collects or sends data. Build-time tools (Metro, Babel, Jest,
the Expo CLI) aren't in the app binary and aren't listed.

| Package | Purpose | Network | Collects data | Notes |
|---|---|---|---|---|
| `expo`, `expo-constants`, `expo-application` | Runtime, app version | No | No | Version number for Settings → About only. |
| `expo-font`, `@expo-google-fonts/*` | Fonts | No | No | Font files are bundled in the app. Nothing is fetched from Google at runtime. |
| `expo-splash-screen`, `expo-status-bar` | Launch screen, status bar | No | No | |
| `react`, `react-native`, `react-dom`, `react-native-web`, `@expo/metro-runtime` | UI framework (web packages only power the browser preview) | No | No | |
| `react-native-safe-area-context`, `react-native-svg`, `expo-linear-gradient` | Layout, icons, gradients | No | No | |
| `@react-native-async-storage/async-storage` | Saves data on the phone | No | No | Protected by `NSFileProtectionComplete`. |
| `@react-native-community/datetimepicker` | Native date and time pickers | No | No | |
| `expo-local-authentication` | Face ID / passcode lock | No | No | iOS does the check. The app only learns "passed" or "failed". |
| `expo-notifications` | Local daily reminder | **No** | No | Local notifications only. The push entitlement is removed (`plugins/withoutPushEntitlement.js`), and no push token is ever requested. |
| `expo-image-picker` | Progress photos | No | No | The photo is copied into the app's private folder. The picker's temp copy is deleted right after, and the cache is swept on every launch as a backstop. |
| `expo-document-picker`, `expo-file-system`, `expo-sharing` | Restore and export backups | No | No | The person chooses where an export goes. Temp files are deleted. |
| `expo-haptics` | Taps and success feedback | No | No | |
| `expo-crypto` | Secure random bytes for backup encryption | No | No | |
| `@noble/ciphers`, `@noble/hashes` | Password-protected backups (XChaCha20-Poly1305, scrypt) | No | No | Audited, pure JavaScript, MIT. |
| `expo-web-browser` | Opens the privacy policy | Only when tapped | No | Opens one fixed https URL in Safari View Controller. |
| `expo-iap` | Tidemark Plus purchases (StoreKit 2) | **Yes, to Apple only** | No | Talks to the App Store to load prices, buy, restore and check Plus. Apple learns that a purchase happened, never anything entered in the app. Pinned to an exact version, because its API changes often. |

No analytics, crash reporting, advertising, attribution or social SDKs are included. `npm audit --omit=dev`
advisories are confined to build tooling (see README → Security). CI fails on any new high or critical one
(`scripts/audit.js`, which lists the reviewed ones and why).
