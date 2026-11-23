// Plain CSV for spreadsheets: one row per date with weight, measurements, calories, protein and that day's tags and note.
// Free for everyone, including what was logged with Plus: it's the person's own record.
import { MEASURES } from './body';
import type { DayNotes } from './notes';
import type { Measurements, Weights } from './types';
import type { Intake } from './calories';
import type { ProteinLog } from './protein';

/** A free-text cell: quoted, and never read as a formula by a spreadsheet (a note starting "=", "+", "-" or "@"). */
function textCell(t: string): string {
  const safe = /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function toCsv(weights: Weights, measurements: Measurements, intake: Intake = {}, notes: DayNotes = {}, protein: ProteinLog = {}): string {
  const dates = Array.from(new Set([...Object.keys(weights), ...Object.keys(measurements), ...Object.keys(intake), ...Object.keys(notes), ...Object.keys(protein)])).sort();
  const head = ['date', 'weight_kg', ...MEASURES.map(m => `${m.key}_cm`), 'kcal', 'protein_g', 'tags', 'note'];
  const rows = dates.map(k => [k, weights[k] ?? '', ...MEASURES.map(m => measurements[k]?.[m.key] ?? ''), intake[k] ?? '', protein[k] ?? '',
    (notes[k]?.tags ?? []).join(';'), notes[k]?.text ? textCell(notes[k].text!) : ''].join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}
