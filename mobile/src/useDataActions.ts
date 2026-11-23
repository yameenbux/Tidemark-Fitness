import { backupFolder } from '../modules/backup-folder';
import { buildExportText, parseBackup } from './core/backup';
import { isVault, MIN_PASSWORD, openAsync, sealAsync } from './core/vault';
import { secureRandom } from './secureRandom';
import { toCsv } from './core/csv';
import { dateKey, parseKey, startOfDay } from './core/dates';
import { DEFAULT_PREFS } from './core/storage';
import { askPassword, choose, confirm, notify } from './dialogs';
import { clearCache, pickBackupText, shareBackup } from './io';
import { deleteAllPhotos, deletePhoto } from './photos';
import { applyDoseReminders, applyReminder } from './reminders';
import { FEATURES } from './features';
import { eraseStorage, latestRescue, latestSnapshot, Tracker } from './store';

type Show = (m: { message: string; action?: string; onAction?: () => void }) => void;

/** Backup, restore, export, clear and erase — every action that moves or removes data in bulk. */
export function useDataActions(t: Tracker, show: Show, done: () => void, plus = true) {
  const { state, prefs } = t;

  const restore = async () => {
    try {
      let text = await pickBackupText();
      if (text == null) return;
      if (isVault(text)) {
        if (!FEATURES.protectedBackups) { notify('Can’t open this backup', 'This version of Tidemark can’t open password-protected backups. Export a backup without a password and restore that.'); return; }
        const pw = await askPassword('Backup password', 'This backup is protected. Enter the password it was saved with.');
        if (pw == null) return;
        show({ message: 'Unlocking backup…' });
        await new Promise(r => setTimeout(r, 60));
        text = await openAsync(text, pw);                             // throws a readable message on a wrong password
      }
      const b = parseBackup(text, state.settings);
      const nW = Object.keys(b.weights).length, nH = Object.keys(b.habits).length;
      const ok = await confirm('Restore this backup?',
        `${nW} weigh-in${nW === 1 ? '' : 's'} and ${nH} day${nH === 1 ? '' : 's'} of habits.\n\nThis replaces everything currently in Tidemark.`, 'Restore');
      if (!ok) return;
      const saved = await t.snapshot('before_restore');
      const before = state;
      // Photos aren't in backups, so the ones already on this phone are kept
      t.replaceAll({ settings: b.settings, weights: b.weights, entries: b.entries, habits: b.habits, measurements: b.measurements, photos: state.photos,
        intake: b.intake, lifts: b.lifts, doses: b.doses ?? {}, notes: b.notes ?? {}, effects: b.effects ?? {}, protein: b.protein ?? {}, unit: b.unit ?? state.unit });
      // Read Apple Health from the start again: readings newer than the backup come back, and none is added twice
      const rereadHealth = () => { if (prefs.health.on) t.setPrefs({ health: { on: true, anchor: null } }); };
      rereadHealth();
      done();
      // Undo puts back the newest snapshot (what was here before this restore), or the copy in memory if it wasn't written
      show({ message: `Restored ${nW} weigh-in${nW === 1 ? '' : 's'}`, action: 'Undo',
        onAction: async () => { t.replaceAll((saved && (await latestSnapshot())) || before); rereadHealth(); } });
    } catch (e) {
      notify("Couldn't restore", e instanceof Error ? e.message : "That file couldn't be read.");
    }
  };

  const exportCsv = async () => {
    try { await shareBackup('tidemark-' + dateKey(new Date()) + '.csv', toCsv(state.weights, state.measurements, state.intake, state.notes, state.protein ?? {}), 'csv'); }
    catch { notify('Export failed', 'Nothing was shared. Try again.'); }
  };

  const exportData = async () => {
    if (!state.settings) return;
    // A backup leaves the phone, so offer to lock it with a password first
    const how = !FEATURES.protectedBackups || !plus ? 'plain' : await choose('Protect this backup?', 'A password keeps the file private wherever it ends up. You’ll need it to restore, and it can’t be recovered if you forget it.',
      [{ id: 'password', label: 'Add a password' }, { id: 'plain', label: 'No password' }]);
    if (!how) return;
    let text = buildExportText({ ...state, settings: state.settings });
    if (how === 'password') {
      const pw = await askPassword('Choose a password', `At least ${MIN_PASSWORD} characters.`);
      if (pw == null) return;
      if (pw.length < MIN_PASSWORD) { notify('Password too short', `Use at least ${MIN_PASSWORD} characters.`); return; }
      if ((await askPassword('Type it again', 'To make sure there’s no typo.')) !== pw) { notify('Passwords didn’t match', 'Nothing was exported. Try again.'); return; }
      show({ message: 'Locking your backup…' });
      await new Promise(r => setTimeout(r, 60));                   // let the message paint before the (deliberately slow) key step
      text = await sealAsync(text, pw, secureRandom);
    }
    try {
      await shareBackup('tidemark-' + dateKey(new Date()) + (how === 'password' ? '-protected' : '') + '.txt', text);
      // The share sheet closes the same way whether the file was saved or the sheet was cancelled, so ask
      if (await confirm('Did you save the backup?', 'Only say yes if the file went somewhere safe: Files, iCloud Drive, email or a computer.', 'Yes, it’s saved', false)) {
        t.setPrefs({ lastBackup: new Date().toISOString() });
        show({ message: 'Backup saved' });
      }
    } catch { notify('Export failed', 'Nothing was shared. Try again.'); }
  };

  /** Shares the untouched copy of data that couldn't be read, so nothing is ever truly lost. */
  const exportRescued = async () => {
    const raw = await latestRescue();
    if (!raw) { notify('Nothing to export', 'There is no saved copy on this phone.'); return; }
    try { await shareBackup('tidemark-rescued-' + dateKey(new Date()) + '.txt', raw); }
    catch { notify('Export failed', 'Nothing was shared. Try again.'); }
  };

  const reset = async () => {
    const s = state.settings;
    if (!s) return;
    if (!(await confirm('Clear all weigh-ins and habit ticks?', 'Your plan, sessions and meals are kept. Export a backup first if you might want this data back.', 'Clear'))) return;
    const before = state;
    t.replaceAll({ ...state, weights: parseKey(s.plan.start) <= startOfDay() ? { [s.plan.start]: s.plan.startKg } : {}, habits: {} });
    done();
    show({ message: 'Weigh-ins and ticks cleared', action: 'Undo', onAction: () => t.replaceAll(before) });
  };

  const eraseAll = async () => {
    if (!(await confirm('Delete all your data?', 'This deletes your plan, every weigh-in, habit, measurement and progress photo from this phone. It can’t be undone. Export a backup first if you might want any of it.' + (prefs.autoBackup.on ? ' Automatic backups already in your backup folder are kept.' : ''), 'Erase'))) return;
    if (!(await confirm('Are you sure?', 'Tidemark will start again from setup.', 'Delete everything'))) return;
    t.discardPending();   // a save still waiting must not bring the old data back after erasing
    if (!(await eraseStorage())) { notify('Couldn’t erase', 'Nothing was deleted. Try again.'); return; }
    for (const day of Object.values(state.photos)) for (const ref of Object.values(day)) if (ref) deletePhoto(ref);
    deleteAllPhotos();
    clearCache();                                  // exported files, picked backups, photo-picker leftovers
    backupFolder?.forget();                        // stop automatic backups (files already in that folder are the person's)
    await applyReminder({ ...prefs.reminder, on: false });
    await applyDoseReminders(null, {});
    done();
    t.replaceAll({ settings: null, weights: {}, habits: {}, unit: state.unit, measurements: {}, photos: {}, intake: {}, lifts: {} });
    t.setPrefs({ ...DEFAULT_PREFS, plus: prefs.plus });   // Plus belongs to the Apple ID, not the data
  };

  return { restore, exportCsv, exportData, exportRescued, reset, eraseAll };
}
