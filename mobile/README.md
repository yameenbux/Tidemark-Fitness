# Tidemark — iPhone app

The native version of Tracker, now called **Tidemark**, built with Expo (React Native) so it can be developed without a Mac.
Same idea as the web app: no account, nothing leaves the phone, and the target line is a guide, not a verdict.

## Try it on your iPhone (free, no Apple developer account)

You need a computer (Windows is fine) and your iPhone on the same Wi-Fi.

1. Install **Node.js LTS** from nodejs.org.
2. On your iPhone, install **Expo Go** from the App Store.
3. In a terminal:
   ```bash
   git clone https://github.com/yameenbux/Tidemark-Fitness.git
   cd Tidemark-Fitness/mobile
   npm install
   npx expo start
   ```
4. Scan the QR code that appears with the iPhone **Camera** app. It opens in Expo Go.

If the phone can't connect (work or university Wi-Fi often blocks it), run `npx expo start --tunnel` instead.
If Expo Go says the project needs a different SDK version, update Expo Go from the App Store.

## What's in it

**Free and Plus.** The core is free: weigh-ins, the trend and plan, notes and tags on a day, Apple Health sync, the
medication log with dose reminders, holding mode after the goal, "hide my weight", reminders, Face ID lock, backups,
up to 3 habits, waist measurements. **Tidemark Plus** (£2.99 a month, £19.99 a year with a 7-day free trial or a launch
price, or £49.99 once) adds
medication insights (trend at each dose, injection-site rotation, side effects against the dose cycle), a PDF report
for a doctor, a daily protein minimum, all 6 habits, photos and the other measurements, calories, and password-protected backups. It's sold through Apple with
StoreKit 2 (`expo-iap`): no account, no server and no third-party purchase SDK, so the privacy answer stays "Data Not
Collected". Logic in `src/core/plus.ts`; store calls in `src/purchases.ts`; `usePlus()` and the paywall in `src/plus.tsx`.
Anything entered in a Plus feature is kept if Plus lapses, and shows again when it's back. Product IDs (create these
in App Store Connect): `com.yameenbux.tidemark.plus.monthly` and `.yearly` (one subscription group; yearly carries the
introductory offer: the £11.99 launch price, then a 7-day free trial) and `com.yameenbux.tidemark.plus.lifetime` (non-consumable).

- **Setup**: one question per screen — current weight, goal, then a pace (Gentle / Steady / Brisk / Fast, as a share of
  body weight per week), with a "How is this worked out?" explainer. Optional Face ID lock at the end.
- **Today**: current weight and progress, insight tiles (trend with sparkline, weekly pace and goal date, habits,
  body or calories) that open their tab, today's habits as one-tap ticks, and an event countdown.
- **Trend**: trend weight and the honest weekly rate, a 3 / 7 / 14 / 30-day change table, the chart (4W / 12W / Plan),
  the jump explainer, "Re-plan from here", and the full weigh-in history (tap to edit).
- **Habits**: this week's checklist with sessions and meals, 30-day dot grids (consistency, not streaks), and Patterns
  after 8 weeks.
- **Body**: waist/hips/chest/arm measurements, private progress photos with then-and-now, and optional calories with an
  estimate of what you really burn.
- **Log weight** (the + in the tab bar): opens on your last weight with −/+ steppers, so most weigh-ins are two taps.
  Deleting shows an Undo.
- **Medication** (optional, e.g. a weekly GLP-1 injection): name, dose and schedule; Today shows when the next dose is due
  with one tap to mark it taken (or flags a weekly dose that isn't marked); the Trend tab shows how the trend moved at
  each dose strength; a dose history to add or clear past doses; an optional dose-day reminder that doesn't name the
  medication. Stopping asks whether to keep or delete the history. A record only: it never suggests doses.
- **Notes and tags** (`src/core/notes.ts`): quick tags (salty meal, alcohol, travel, period, poor sleep…) and a line of
  text on any day, from the log sheet. Shown under weigh-ins, as marks on the chart and in the jump explainer.
- **Hide my weight** (Settings → Display): the hero shows which way the trend is going this week; charts drop their
  axis numbers; the log sheet neither prefills nor echoes the weight. Exports and the doctor report keep real numbers.
- **Holding** (`holdingPlan` in `src/core/plan.ts`): at the goal, the Trend tab offers a 26-week holding plan with a
  1.5 kg range. Past the goal is "At goal", never "Ahead".
- **Apple Health** (`src/health.ts`, `src/useHealth.ts`, logic in `src/core/health.ts`): off by default. Reads body
  weight with HealthKit anchors on launch, on return and when Health changes; writes typed weigh-ins, tagged so they're
  never imported back. A typed weight wins for its day. Uses `@kingstinct/react-native-healthkit` (no official Expo
  module exists); needs a development or App Store build.
- **Doctor report** (Plus, `src/core/report.ts`): the last 12 weeks as a PDF made on the phone with `expo-print`.
- **Protein minimum** (Plus, `src/core/protein.ts`): 1.2–1.6 g per kg of the lower of trend and goal weight.
- **Settings**: an iOS grouped list — plan and breaks, event, units, habits, sessions, meals, calories, a daily weigh-in
  reminder, Face ID lock, automatic backup, export (backup or CSV), restore, clear, erase everything, privacy policy.
- **Safety**: saved data that can't be read is copied aside rather than overwritten; a snapshot is taken before restore;
  the lock hides everything (including the app-switcher preview).
- **Automatic backups** (free, iOS): the person picks a folder once (on the phone or in iCloud Drive) and Tidemark
  writes that day's backup there about 15 seconds after any change and as the app leaves the screen, keeping the newest
  14 (`src/core/autoBackup.ts`, `src/useAutoBackup.ts`). The folder is held as a security-scoped bookmark by a small local
  Swift module, `modules/backup-folder`; Expo Go, the web build and Android don't have it, so the feature is hidden
  there. Nothing is written while saved data failed to load, so a bad start can't overwrite a good backup. The files
  are ordinary plain-text backups (no photos, no password) that Restore reads like any other.
- **Backups** use the same format as the web app, so a `.txt` exported from the website restores here, and the other way round.
  The website keeps the parts it doesn't show (doses, measurements, calories, session weights, pounds) and writes them
  back out, so nothing is lost passing through it; weigh-in records are rebuilt from the daily weights.

## Security

What each protection is, and what it isn't:

- **No network surface.** No server, account, analytics or data-collecting SDKs (the HealthKit binding talks only to iOS). EAS builds with the `production` profile have no
  App Transport Security exceptions and no URL scheme (`plugins/withProductionHardening.js`); development builds and local
  builds without that profile keep local networking so they can load code from Metro.
- **iOS file encryption.** `NSFileProtectionComplete`: while the phone is locked, the app's files are encrypted with a key
  tied to the device passcode and can't be read. **Not yet verified in a signed device build** (only in generated config).
- **Face ID lock and app-switcher cover.** The lock is a screen in front of the app, asked for on every return; it is not a
  separate encryption key. The cover blanks the app switcher whenever the app isn't active (lock on or off).
- **Device backups.** iCloud/computer backups include the app's data, as for every app; that's what makes a lost phone
  recoverable. Backups can be password-protected (`src/core/vault.ts`: scrypt N=2^15 key, XChaCha20-Poly1305, audited
  `@noble` libraries, system randomness via expo-crypto); unprotected backups and the CSV are plain text.
- **Untrusted input.** Restored backups are size-limited (10 MB), parsed defensively and cleaned field by field (dates,
  ranges, lengths, counts, prototype keys); nothing is evaluated. A snapshot is kept for 30 days before any restore.
- **Notifications** never contain a weight or other figure; there's no push entitlement.
- **Widgets** (`src/widgets/`, `expo-widgets`) show the trend on the Home Screen and Lock Screen, so they deliberately put
  numbers outside the app. What they get is a small snapshot the app hands over (`src/core/widgetData.ts`): the trend,
  this week's change, progress and the last 30 days scaled 0–1, no raw history. With the **Face ID lock on they get
  nothing** but "locked". The snapshot sits in the app group `group.com.yameenbux.tidemark`; every number is marked
  `privacySensitive` so iOS can hide it on a locked Lock Screen. The extension has its own privacy manifest
  (`plugins/withWidgetPrivacyManifest.js`, reason 1C8F.1). **Not yet verified on a device:** how the app's
  `NSFileProtectionComplete` applies to the app-group snapshot while the phone is locked (iOS keeps showing the last
  rendered widget either way).
- **Dependencies.** `npm audit --omit=dev` reports advisories only in build-time tooling (Metro's `braces`, the Expo CLI's
  `node-forge`, the Jest preset's `sprintf-js`, the Xcode project editor's `uuid`). None of these ship in the app binary.
  Re-check after each Expo SDK upgrade.
- **Not done (by design):** jailbreak detection (easily bypassed, and a jailbroken owner already has their own data) and
  certificate pinning (no network calls to pin).

## Not in this version yet

- **Apple Health sync is built but untested on a device**: Expo Go can't use HealthKit. Test it in a development or
  TestFlight build (EAS turns on the HealthKit capability from the config plugin).
- **Automatic backups are built but untested on a device**: the Swift module compiles in CI (`ios-build.yml`) but hasn't run on a phone. Before release,
  in a development or TestFlight build: pick a folder on the phone and one in iCloud Drive, change data, check the file
  appears, relaunch (the folder must still work), rename and delete the folder (Settings and Today must say it isn't
  saving), and restore from one of the files. The files leave out readings from Apple Health (`withoutHealth` in
  `core/autoBackup.ts`), so a folder in iCloud Drive never holds HealthKit data (Guideline 5.1.3(ii)); after a
  restore, Tidemark reads Health again from the start. Say this in the App Review notes.
- **iCloud sync** — not built. App Review Guideline 5.1.3(ii) says apps using HealthKit may not store personal health
  information in iCloud. Settle that (e.g. ask App Review, or sync only what didn't come from Health) before building it.
- **Apple Watch app** — not built. It needs a native watchOS target (Swift), which can't be compiled or tested here; an
  untested target could break the whole iOS build.
- **Widgets need a development or App Store build**: Expo Go has no widget extension. They're built with the app by
  EAS; nothing to set up beyond letting EAS register the app group the first time it asks.

## Device test plan

CI compiles everything for the simulator (`.github/workflows/ios-build.yml`), which proves it builds, not that it works.
Run this once on a real iPhone from **TestFlight**. Purchases there use Apple's sandbox, so nothing is charged. The
Expo project is `@ysb-designs/tidemark`, and signing is managed by EAS for the YSB Ventures team. To make a build:
`npx --yes eas-cli@latest build -p ios --profile production`, then `npx --yes eas-cli@latest submit -p ios --latest`.
Each line says what should happen; anything else is a bug.

**Data and locking**
1. Log weigh-ins on three days, force-quit, reopen: all three are there.
2. Turn on the Face ID lock, send the app to the background: the app-switcher picture is blank; reopening asks for Face ID.
3. Lock the phone for 10 minutes with the app in the background, unlock, open: nothing lost, no "couldn't read" notice.

**Apple Health** (Settings → Apple Health)
4. Turn it on, allow read and write: weights already in Health appear as weigh-ins.
5. Log a weight in Tidemark: it shows in the Health app as one sample from Tidemark.
6. Edit that weigh-in: Health still has **one** Tidemark sample for the day, with the new value.
7. Delete it in Tidemark: Tidemark's sample leaves Health; a scale's reading for that day stays.
8. Add a weight in the Health app: it appears in Tidemark within a few seconds of reopening.
9. Export a backup, delete a Health-only day in Tidemark, restore the backup: the Health readings come back.

**Automatic backups** (Settings → Automatic backup)
10. Choose a folder on the phone: a `Tidemark backup <date>.txt` appears in Files within 20 seconds.
11. Open the file: weights you typed are in it; readings from Health are not.
12. Relaunch the app, change data: the same day's file is updated (the folder is remembered).
13. Rename or delete the folder in Files: Settings and Today say backups aren't saving.
14. Restore from one of the files: it works like any other backup.

**Widgets**
15. Add the medium and small widgets and a Lock Screen widget: they show the trend.
16. Log a weigh-in: the widgets update.
17. Turn on the Face ID lock: widgets show "locked", no numbers.
18. Leave the phone locked overnight: the next morning the widgets still show the last trend (not blank or an error).
    This is the open question about `NSFileProtectionComplete`; if they go blank, tell Claude and the protection class
    for the shared snapshot gets changed.

**Plus** (TestFlight, sandbox tester, products set up in App Store Connect)
19. The paywall shows Apple's prices; with the launch offer set, yearly says "£11.99 for the first year, then £19.99 a year".
20. Buy monthly: Plus features unlock at once. Delete and reinstall, tap Restore: Plus comes back.
21. Cancel in Settings → Apple ID → Subscriptions, let the sandbox period run out: Plus ends; data entered in Plus stays.
22. Buy lifetime on a second sandbox account: unlocks, and Restore brings it back.

**Reminders and the rating prompt**
23. Set a weigh-in reminder two minutes ahead, lock the phone: the notification arrives and doesn't show a weight.
24. In a development build with 14+ weigh-ins over 21+ days and a good week, log today's weight: Apple's rating
    prompt appears about 2.5 seconds later (development builds always show it; TestFlight never does).

## Before a release

- **Errors:** there's no crash-reporting SDK (it would send data off the phone and break "Data Not Collected"). The
  error screen offers "Email the error to support" with the error and app version only. For crashes, use the reports
  Apple collects from people who opted in: App Store Connect → TestFlight / App Analytics → Crashes, or Xcode's
  Organizer.
- **Risky features can be switched off for a build** (`src/features.ts`): set `EXPO_PUBLIC_DISABLE_MEDICATION=1`
  (hides the medication log and dose reminders; saved doses are kept) or `EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS=1`
  (plain backups only) in `eas.json` under the build profile's `env`. There's no remote switch, because there's no server.
- **Website:** `.github/workflows/pages.yml` publishes the privacy policy, the web test build (private, `noindex`) and classic tracker on every push
  to `main`; `site-check.yml` checks them every 6 hours and fails (GitHub emails the failure) if one is down.
- **Logging:** app code can't call `console` (lint rule), so release builds log nothing of ours.

## Development

```bash
npm test            # unit tests (src/core) plus UI and storage tests (src/__tests__)
npm run typecheck
npx expo lint
npx expo export --platform web   # web build, used for screenshot testing
```

`src/core` is plain TypeScript with no React and is close to fully unit-tested. `src/__tests__/app.test.tsx` drives the
whole app (setup, logging, tabs, the lock, deleting all data) on top of that. Overall coverage, counting every source
file (`npx jest --coverage`), is about 76% of statements, and CI fails if it drops below the floor set in `package.json`; the gaps are mainly the thin wrappers around native features
(camera, files, Face ID) that need a device, which no automated test here runs on yet. CI runs all of this on every push
(`.github/workflows/ci.yml`).
The `ios/` and `android/` folders are generated by Expo when building and are not committed.
