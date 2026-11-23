import { EmptyState, Skeleton } from './States';
import { memo, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Image, ImageStyle, Platform, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { cmToUnit, LengthUnit, lengthToCm, MEASURES, measureSummary, photoDates, plausibleCm, POSES, setMeasureDay, setPhotoRef, showLength } from '../core/body';
import { dateKey, longDate, parseKey, shortDate } from '../core/dates';
import { weightSeries } from '../core/plan';
import { trendSeries, TrendPoint } from '../core/trend';
import { num, showWeight } from '../core/units';
import type { MeasureKey, Measurements, PhotoLog, Pose, Settings, Unit, Weights } from '../core/types';
import { confirm, notify } from '../dialogs';
import { addPhoto, deletePhoto, photoUri } from '../photos';
import { C, F, themed, useScheme } from '../theme';
import { DateInput, Field, fieldStyles } from './Fields';
import { Icon } from './Icons';
import { DoneInput } from './KeyboardDone';
import { Sheet } from './Sheet';
import { Button, Card, Tabs } from './ui';

interface Choice { label: string; destructive?: boolean; run: () => void }
/** Native action sheet on iPhone (the iOS control for "what do you want to do with this"); first option on web. */
function choose(title: string, options: Choice[]) {
  if (Platform.OS === 'web') { options[0]?.run(); return; }
  if (Platform.OS === 'ios') {
    const d = options.findIndex(o => o.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...options.map(o => o.label), 'Cancel'], cancelButtonIndex: options.length, destructiveButtonIndex: d >= 0 ? d : undefined },
      i => { if (i < options.length) options[i].run(); });
    return;
  }
  Alert.alert(title, undefined, [...options.map(o => ({ text: o.label, style: o.destructive ? 'destructive' as const : 'default' as const, onPress: o.run })),
                                 { text: 'Cancel', style: 'cancel' as const }]);
}
function confirmDelete(title: string, message: string, run: () => void) {
  confirm(title, message, 'Delete').then(ok => { if (ok) run(); });
}

/** Trend weight on (or just before) a date, for labelling photos. */
function trendOn(series: TrendPoint[], k: string): number | null {
  let v: number | null = null;
  for (const p of series) { if (p.k <= k) v = p.trend; else break; }
  return v;
}

/** A stored photo with a breathing placeholder until it has decoded (large photos take a moment). */
function LoadingImage({ uri, style, label }: { uri: string; style: ImageStyle; label: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {state === 'loading' && <Skeleton style={StyleSheet.absoluteFill as ViewStyle} />}
      {state === 'failed'
        ? <View style={[StyleSheet.absoluteFill, s.cmpEmpty]}><Icon name="body" size={22} color={C.inkSoft} /><Text style={s.cmpEmptyTxt}>Photo missing</Text></View>
        : <Image source={{ uri }} style={StyleSheet.absoluteFill} accessibilityLabel={label}
            onLoad={() => setState('ok')} onError={() => setState('failed')} />}
    </View>
  );
}

/** Free: adding the waist (the one measurement that answers "is the trend real?"); adding the rest and photos is Plus. */
const WAIST_ONLY = MEASURES.filter(m => m.key === 'waist');

/**
 * Measurements and progress photos. `free` (no Plus): only the waist can be added, but everything already entered,
 * from a time with Plus, stays on show: what someone recorded is theirs to see, whether or not they pay. `onPlus`
 * opens Plus from the free version's photo button.
 */
export const BodyCard = memo(function BodyCard({ settings, weights, unit, lengthUnit, onLengthUnit, measurements, photos, onMeasurements, onPhotos, free = false, onPlus }: {
  settings: Settings; weights: Weights; unit: Unit; lengthUnit: LengthUnit; onLengthUnit: (u: LengthUnit) => void; measurements: Measurements; photos: PhotoLog;
  onMeasurements: (m: Measurements) => void; onPhotos: (p: PhotoLog) => void; free?: boolean; onPlus?: () => void;
}) {
  useScheme();                                   // repaint when the appearance changes (memo skips parent renders)
  const [sheet, setSheet] = useState<null | 'measure' | 'photos'>(null);
  const [pose, setPose] = useState<Pose>('front');
  const dates = photoDates(photos).filter(k => photos[k][pose]);
  const [thenKey, setThenKey] = useState<string | null>(null);
  const before = thenKey && dates.includes(thenKey) ? thenKey : dates[0];
  const after = dates[dates.length - 1];
  const list = free ? WAIST_ONLY : MEASURES;                    // what can be added
  const summaries = MEASURES.map(m => ({ m, s: measureSummary(measurements, m.key) })).filter(x => x.s);   // what's shown: all of it
  const anyPhotos = photoDates(photos).length > 0;
  const photosShown = !free || anyPhotos;
  const series = useMemo(() => trendSeries(weightSeries(settings.plan, weights)), [settings.plan, weights]);

  const photoBox = (k: string, label: string) => {
    const tw = trendOn(series, k);
    return (
      <View style={s.cmpCol}>
        <LoadingImage key={photos[k][pose]} uri={photoUri(photos[k][pose]!)} style={s.cmpImg} label={`${label} photo, ${longDate(k)}`} />
        <View style={s.cmpBadge}><Text style={s.cmpBadgeTxt}>{label} · {shortDate(parseKey(k))}</Text></View>
        {tw != null && <Text style={s.cmpW}>{showWeight(tw, unit)} trend</Text>}
      </View>
    );
  };

  return (
    <Card title={free && !anyPhotos && summaries.every(x => x.m.key === 'waist') ? 'Waist' : 'Measurements & photos'} right={<View style={{ flexDirection: 'row', gap: 6 }}>
      <Button icon="plus" label="Measure" kind="ghost" small onPress={() => setSheet('measure')} />
      {!free ? <Button icon="plus" label="Photos" kind="ghost" small onPress={() => setSheet('photos')} />
        : anyPhotos && onPlus ? <Button icon="plus" label="Photos · Plus" kind="ghost" small onPress={onPlus} /> : null}
    </View>}>
      {summaries.length > 0 ? (
        <View style={s.chips}>
          {summaries.map(({ m, s: sm }) => (
            <View key={m.key} style={s.chip} accessible accessibilityLabel={`${m.label} ${showLength(sm!.latest.cm, lengthUnit)}`}>
              <Text style={s.chipK}>{m.label}</Text>
              <Text style={s.chipV}>{showLength(sm!.latest.cm, lengthUnit)}</Text>
              {sm!.first.k !== sm!.latest.k && (
                <Text style={[s.chipD, { color: sm!.change < -0.05 ? C.mintInk : sm!.change > 0.05 ? C.coralInk : C.inkSoft }]}>
                  {sm!.change > 0 ? '+' : sm!.change < 0 ? '−' : ''}{showLength(Math.abs(sm!.change), lengthUnit)} since {shortDate(parseKey(sm!.first.k))}
                </Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState compact icon="ruler" title="No measurements yet" body="Your waist often keeps shrinking in weeks the scale stalls. Measure every 2–4 weeks, same time of day." action="Add a measurement" onAction={() => setSheet('measure')} />
      )}

      {!photosShown ? null : anyPhotos ? (
        <View style={{ marginTop: 14 }}>
          <Tabs value={pose} onChange={setPose} label="Photo pose" options={POSES.map(p => ({ id: p.key, label: p.label }))} />
          {dates.length >= 2 ? (
            <View style={s.cmp}>{photoBox(before, 'Then')}{photoBox(after, 'Now')}</View>
          ) : dates.length === 1 ? (
            <View style={s.cmp}>{photoBox(dates[0], 'First')}<View style={[s.cmpCol, s.cmpEmpty]}><Text style={s.cmpEmptyTxt}>Take another {POSES.find(p => p.key === pose)!.label.toLowerCase()} photo in a few weeks to compare</Text></View></View>
          ) : (
            <EmptyState compact icon="body" title={`No ${pose} photos yet`} action={free ? undefined : 'Add photos'} onAction={free ? undefined : () => setSheet('photos')} />
          )}
          {dates.length > 2 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
              {dates.slice(0, -1).map(k => (
                <Pressable key={k} onPress={() => setThenKey(k)} hitSlop={4} style={[s.dateChip, k === before && s.dateChipOn]} accessibilityRole="button"
                  accessibilityLabel={`Compare from ${longDate(k)}`} accessibilityState={{ selected: k === before }}>
                  <Text style={[s.dateChipTxt, k === before && { color: C.onFill }]}>{shortDate(parseKey(k))}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <EmptyState compact icon="body" title="No progress photos yet" body="They stay private on this phone, never in your camera roll. Same spot, same light, every few weeks." action="Add photos" onAction={() => setSheet('photos')} />
      )}

      {sheet === 'measure' && <MeasureSheet list={list} unit={lengthUnit} onUnit={onLengthUnit} measurements={measurements} onClose={() => setSheet(null)}
        onSave={m => { onMeasurements(m); setSheet(null); }} />}
      {sheet === 'photos' && <PhotoSheet photos={photos} onClose={() => setSheet(null)} onChange={onPhotos} />}
    </Card>
  );
});

function MeasureSheet({ list, unit, onUnit, measurements, onSave, onClose }: {
  list: typeof MEASURES; unit: LengthUnit; onUnit: (u: LengthUnit) => void; measurements: Measurements; onSave: (m: Measurements) => void; onClose: () => void;
}) {
  // Measurements this sheet doesn't show (kept from Plus) stay as they are when the day is saved or cleared
  const others = (day: string) => Object.fromEntries(Object.entries(measurements[day] ?? {}).filter(([key]) => !list.some(m => m.key === key))) as Partial<Record<MeasureKey, number>>;
  const [k, setK] = useState(dateKey(new Date()));
  const toText = (day: string) => Object.fromEntries(list.map(m => {
    const cm = measurements[day]?.[m.key];
    return [m.key, cm != null ? cmToUnit(cm, unit).toFixed(1) : ''];
  })) as Record<MeasureKey, string>;
  const [txt, setTxt] = useState<Record<MeasureKey, string>>(() => toText(k));
  const changeDate = (d: string) => { setK(d); setTxt(toText(d)); };
  // Switching cm/in converts whatever is already typed, so nothing is saved in the wrong unit
  const switchUnit = (u: LengthUnit) => {
    if (u === unit) return;
    setTxt(t => Object.fromEntries(list.map(m => {
      const v = num(t[m.key]);
      return [m.key, t[m.key].trim() && isFinite(v) && v > 0 ? cmToUnit(lengthToCm(v, unit), u).toFixed(1) : t[m.key]];
    })) as Record<MeasureKey, string>);
    onUnit(u);
  };
  const values: Partial<Record<MeasureKey, number>> = {};
  let bad = false;
  for (const m of list) {
    if (!txt[m.key].trim()) continue;
    const cm = lengthToCm(num(txt[m.key]), unit);
    if (plausibleCm(cm)) values[m.key] = cm; else bad = true;
  }
  const today = dateKey(new Date());
  const existing = list.some(m => measurements[k]?.[m.key] != null);
  const any = Object.keys(values).length > 0;
  const [then, setThen] = useState<null | { run: () => void }>(null);   // animate away, then save
  return (
    <Sheet title="Measurements" onClose={() => (then ? then.run() : onClose())} closing={!!then} footer={<>
      <Button label="Save" disabled={bad || !any || !!then} onPress={() => setThen({ run: () => onSave(setMeasureDay(measurements, k, { ...others(k), ...values })) })} />
      {existing && <Button label={`Delete ${longDate(k)}`} kind="danger" style={{ marginTop: 8 }}
        onPress={() => confirmDelete('Delete these measurements?', `Removes everything measured on ${longDate(k)}.`, () => setThen({ run: () => { const rest = others(k); onSave(setMeasureDay(measurements, k, Object.keys(rest).length ? rest : null)); } }))} />}
    </>}>
      <View style={s.dateRow}><Text style={s.dateLabel}>Date</Text><DateInput value={k} onChange={changeDate} label="Measurement date" max={today} /></View>
      <View style={s.dateRow}><Text style={s.dateLabel}>Measure in</Text>
        <Tabs value={unit} onChange={switchUnit} label="Measure in" options={[{ id: 'cm', label: 'cm' }, { id: 'in', label: 'inches' }]} />
      </View>
      <View style={s.mGrid}>
        {list.map(m => (
          <View key={m.key} style={s.mCell}>
            <Field label={`${m.label} (${unit})`}>
              <DoneInput style={[fieldStyles.fIn, { fontFamily: F.displaySemi }]} value={txt[m.key]} keyboardType="decimal-pad"
                onChangeText={v => setTxt(t => ({ ...t, [m.key]: v }))} placeholder="—" placeholderTextColor={C.placeholder} accessibilityLabel={m.label} />
            </Field>
            <Text style={s.mHint}>{m.hint}</Text>
          </View>
        ))}
      </View>
      {bad && <Text style={s.err}>One of those numbers doesn’t look right. Check the unit ({unit === 'cm' ? 'cm' : 'inches'}).</Text>}
    </Sheet>
  );
}

function PhotoSheet({ photos, onChange, onClose }: { photos: PhotoLog; onChange: (p: PhotoLog) => void; onClose: () => void }) {
  const [k, setK] = useState(dateKey(new Date()));
  const [busy, setBusy] = useState(false);
  const day = photos[k] || {};
  const take = async (source: 'camera' | 'library', pose: Pose) => {
    setBusy(true);
    try {
      const ref = await addPhoto(source, k, pose);
      if (!ref) return;
      if (day[pose]) deletePhoto(day[pose]!);
      onChange(setPhotoRef(photos, k, pose, ref));
    } catch (e) {
      notify('Couldn’t add the photo', e instanceof Error ? e.message : 'Please try again.');
    } finally { setBusy(false); }
  };
  const tap = (pose: Pose) => {
    const label = POSES.find(p => p.key === pose)!.label;
    const opts: Choice[] = [{ label: 'Take photo', run: () => take('camera', pose) }, { label: 'Choose from library', run: () => take('library', pose) }];
    if (day[pose]) opts.push({ label: 'Remove photo', destructive: true, run: () => confirmDelete(`Remove this ${label.toLowerCase()} photo?`,
      'It’s deleted from Tidemark. Photos aren’t in backups, so this can’t be undone.', () => { deletePhoto(day[pose]!); onChange(setPhotoRef(photos, k, pose, null)); }) });
    choose(label + ' photo', Platform.OS === 'web' ? [opts[1]] : opts);
  };
  return (
    <Sheet title="Progress photos" onClose={onClose} footer={<Button label="Done" kind="primary" onPress={onClose} />}>
      <View style={s.dateRow}><Text style={s.dateLabel}>Date</Text><DateInput value={k} onChange={setK} label="Photo date" max={dateKey(new Date())} /></View>
      <View style={s.slots}>
        {POSES.map(p => (
          <Pressable key={p.key} onPress={() => !busy && tap(p.key)} style={s.slot} accessibilityRole="button"
            accessibilityLabel={`${p.label} photo${day[p.key] ? ', added' : ''}`}>
            <Text style={s.slotLabel}>{p.label}</Text>
            {day[p.key]
              ? <Image source={{ uri: photoUri(day[p.key]!) }} style={s.slotImg} />
              : <View style={[s.slotImg, s.slotEmpty]}><Icon name="plus" size={26} color={C.inkSoft} /></View>}
          </Pressable>
        ))}
      </View>
      <Text style={s.tip}>Same spot, same light, same clothes each time, so the only thing that changes is you. Photos stay inside Tidemark and aren’t included in backups.</Text>
    </Sheet>
  );
}

const s = themed(() => StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
  chip: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 13, padding: 11 },
  chipK: { fontFamily: F.bodySemi, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: C.inkSoft, marginBottom: 4 },
  chipV: { fontFamily: F.display, fontSize: 18, color: C.ink },
  chipD: { fontFamily: F.bodySemi, fontSize: 12.5, marginTop: 3 },
  empty: { fontFamily: F.body, fontSize: 14, color: C.inkSoft, lineHeight: 19, paddingHorizontal: 4 },
  cmp: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cmpCol: { flex: 1 },
  cmpImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 14, backgroundColor: C.chip },
  cmpBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: C.scrim, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8 },
  cmpBadgeTxt: { fontFamily: F.bodyBold, fontSize: 12, color: '#fff' },
  cmpW: { fontFamily: F.displaySemi, fontSize: 12.5, color: C.ink, marginTop: 6, textAlign: 'center' },
  cmpEmpty: { aspectRatio: 3 / 4, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center', padding: 14 },
  cmpEmptyTxt: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, textAlign: 'center', lineHeight: 17 },
  dateChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.chip },
  dateChipOn: { backgroundColor: C.fill },
  dateChipTxt: { fontFamily: F.bodySemi, fontSize: 13, color: C.inkSoft },
  mGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  mCell: { flexBasis: '46%', flexGrow: 1 },
  mHint: { fontFamily: F.body, fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 15 },
  err: { fontFamily: F.bodySemi, fontSize: 13.5, color: C.danger, marginTop: 10, lineHeight: 19 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 4, minHeight: 44 },
  dateLabel: { fontFamily: F.bodySemi, fontSize: 15, color: C.ink },
  slots: { flexDirection: 'row', gap: 10, marginTop: 14 },
  slot: { flex: 1, alignItems: 'center' },
  slotLabel: { fontFamily: F.bodySemi, fontSize: 13, color: C.ink, marginBottom: 6 },
  slotImg: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, backgroundColor: C.chip },
  slotEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  tip: { fontFamily: F.body, fontSize: 13, color: C.inkSoft, lineHeight: 17, marginTop: 12 },
}));
