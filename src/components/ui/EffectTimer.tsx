import React from 'react';
import { Activity, Clock, Play, StopCircle, Cog } from 'lucide-react';
import { useMedicationStore } from '@/store';
import { EffectStatus } from '@/types';
import { cn } from '@/utils/helpers';

interface EffectTimerProps {
  medicationId: string;
  compact?: boolean;
}

export function EffectTimer({ medicationId, compact = false }: EffectTimerProps) {
  const medication = useMedicationStore(s => s.medications.find(m => m.id === medicationId));
  const getEffectProfile = useMedicationStore(s => s.getEffectProfile);
  const getCategoryEffectProfile = useMedicationStore(s => s.getCategoryEffectProfile);
  const startEffectSession = useMedicationStore(s => s.startEffectSession);
  const recordEffectFeedback = useMedicationStore(s => s.recordEffectFeedback);
  const endEffectSession = useMedicationStore(s => s.endEffectSession);
  const getActiveEffectSessionForMedication = useMedicationStore(s => s.getActiveEffectSessionForMedication);
  const getEffectPrediction = useMedicationStore(s => s.getEffectPrediction);
  const updateEffectProfile = useMedicationStore(s => s.updateEffectProfile);
  const resetEffectProfileToDefault = useMedicationStore(s => s.resetEffectProfileToDefault);

  const [tick, setTick] = React.useState(0);
  const [customize, setCustomize] = React.useState(false);
  const [applyToCategory, setApplyToCategory] = React.useState(true);
  type TimerMode = 'elapsed' | 'remaining' | 'next';
  const [timerMode, setTimerMode] = React.useState<TimerMode>('elapsed');
  const [autoStop, setAutoStop] = React.useState(false);

  const [onsetIn, setOnsetIn] = React.useState<number | null>(null);
  const [peakIn, setPeakIn] = React.useState<number | null>(null);
  const [wearIn, setWearIn] = React.useState<number | null>(null);
  const [durationIn, setDurationIn] = React.useState<number | null>(null);

  React.useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!medication) {
    return (
      <div className="p-4 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600">
        Medication not found.
      </div>
    );
  }

  const profile = getEffectProfile(medicationId);
  const activeSession = getActiveEffectSessionForMedication(medicationId);
  const prediction = getEffectPrediction(medicationId);

  React.useEffect(() => {
    if (profile) {
      setOnsetIn(profile.onsetMinutes);
      setPeakIn(profile.peakMinutes);
      setWearIn(profile.wearOffStartMinutes);
      setDurationIn(profile.durationMinutes);
      setAutoStop(!!profile.autoStopOnWearOff);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.onsetMinutes, profile?.peakMinutes, profile?.wearOffStartMinutes, profile?.durationMinutes]);

  const handleStart = () => {
    startEffectSession(medicationId);
  };

  const handleFeedback = (status: Exclude<EffectStatus, 'pre_onset'>) => {
    if (!activeSession) return;
    recordEffectFeedback(activeSession.id, status);
    if (status === 'worn_off') {
      endEffectSession(activeSession.id);
    }
  };

  const total = Math.max(1, profile?.durationMinutes || 1);
  const onset = Math.min(total, profile?.onsetMinutes || 0);
  const peak = Math.min(total, profile?.peakMinutes || 0);
  const wear = Math.min(total, profile?.wearOffStartMinutes || 0);
  const nowMinutes = prediction?.minutesSinceDose ?? 0; // re-computed via tick
  const nowPct = Math.min(100, Math.max(0, (nowMinutes / total) * 100));

  const formatDuration = (mins: number): string => {
    const m = Math.max(0, Math.round(mins));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
  };

  const getNextPhaseInfo = (): { minutes: number; label: string } => {
    if (!profile || !prediction) return { minutes: 0, label: '' };
    let target = profile.durationMinutes;
    let label = 'Worn off';
    switch (prediction.status) {
      case 'pre_onset':
        target = profile.onsetMinutes; label = 'Kicking in'; break;
      case 'kicking_in':
        target = profile.peakMinutes; label = 'Peaking'; break;
      case 'peaking':
        target = profile.wearOffStartMinutes; label = 'Wearing off'; break;
      case 'wearing_off':
        target = profile.durationMinutes; label = 'Worn off'; break;
      case 'worn_off':
        target = profile.durationMinutes; label = 'Worn off'; break;
    }
    const minutes = Math.max(0, Math.round(target - nowMinutes));
    return { minutes, label };
  };

  // Auto-stop when worn off if enabled
  React.useEffect(() => {
    if (!activeSession || !profile || !prediction) return;
    if (!profile.autoStopOnWearOff) return;
    if (prediction.status === 'worn_off') {
      endEffectSession(activeSession.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id, profile?.autoStopOnWearOff, prediction?.status]);

  const segmentPct = {
    pre: (onset / total) * 100,
    kick: ((peak - onset) / total) * 100,
    peak: ((wear - peak) / total) * 100,
    wear: ((total - wear) / total) * 100,
  };

  const statusLabelMap: Record<EffectStatus, string> = {
    pre_onset: 'Pre-onset',
    kicking_in: 'Kicking in',
    peaking: 'Peaking',
    wearing_off: 'Wearing off',
    worn_off: 'Worn off',
  };

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', compact ? 'p-3' : 'p-4')}
      style={{ borderColor: '#e5e7eb' }}
    >
      <div className={cn('flex items-center justify-between', compact ? 'mb-2' : 'mb-3')}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: medication.color }} />
          <div className="truncate">
            <div className="text-sm font-medium text-gray-900 truncate">{medication.name}</div>
            {profile && (
              <div className="text-xs text-gray-500">Conf: {Math.round(profile.confidence * 100)}% • Samples: {profile.samples}</div>
            )}
          </div>
        </div>
        {!activeSession ? (
          <button onClick={handleStart} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">
            <Play className="h-3.5 w-3.5" /> Start
          </button>
        ) : (
          <button onClick={() => endEffectSession(activeSession.id)} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">
            <StopCircle className="h-3.5 w-3.5" /> End
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <div className="w-full bg-gray-200 rounded-full h-2 relative overflow-visible pb-6">
          <div className="absolute left-0 top-0 h-2 bg-blue-200" style={{ width: `${segmentPct.pre}%` }} />
          <div className="absolute top-0 h-2 bg-green-400" style={{ left: `${segmentPct.pre}%`, width: `${segmentPct.kick}%` }} />
          <div className="absolute top-0 h-2 bg-indigo-500" style={{ left: `${segmentPct.pre + segmentPct.kick}%`, width: `${segmentPct.peak}%` }} />
          <div className="absolute top-0 h-2 bg-yellow-400" style={{ left: `${segmentPct.pre + segmentPct.kick + segmentPct.peak}%`, width: `${segmentPct.wear}%` }} />
          {/* Now marker */}
          {activeSession && (
            <div className="absolute -top-1 h-4 w-0.5 bg-black/70" style={{ left: `calc(${nowPct}% - 1px)` }} />
          )}
          {/* Time-of-day label under current marker */}
          {activeSession && (
            <div
              className="absolute text-[10px] text-gray-700"
              style={{
                left: `${Math.min(97, Math.max(3, nowPct))}%`,
                transform: 'translateX(-50%)',
                top: '12px'
              }}
            >
              <span
                role="button"
                tabIndex={0}
                title="Tap to toggle elapsed / remaining / until next phase"
                onClick={() => setTimerMode(m => (m === 'elapsed' ? 'remaining' : m === 'remaining' ? 'next' : 'elapsed'))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTimerMode(m => (m === 'elapsed' ? 'remaining' : m === 'remaining' ? 'next' : 'elapsed')); } }}
                className="px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm cursor-pointer select-none"
              >
                {timerMode === 'elapsed' && `${formatDuration(nowMinutes)}`}
                {timerMode === 'remaining' && `${formatDuration(Math.max(0, total - nowMinutes))} left`}
                {timerMode === 'next' && (() => { const n = getNextPhaseInfo(); return `${formatDuration(n.minutes)} to ${n.label}`; })()}
              </span>
            </div>
          )}
          {/* Phase labels (hidden on mobile to avoid crowding) */}
          <div className="absolute -top-4 left-0 right-0 hidden sm:flex justify-between text-[10px] text-gray-600">
            <span className="translate-x-0">Onset</span>
            <span style={{ transform: `translateX(-50%)`, left: `${((onset + peak) / 2 / total) * 100}%` }} className="absolute">Kicking in</span>
            <span style={{ transform: `translateX(-50%)`, left: `${((peak + wear) / 2 / total) * 100}%` }} className="absolute">Peaking</span>
            <span className="-translate-x-full">Wearing off</span>
          </div>
        </div>
      </div>

      {/* Status and controls */}
      <div className={cn('mt-3 grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-4')}>
        {(['kicking_in','peaking','wearing_off','worn_off'] as Array<Exclude<EffectStatus,'pre_onset'>>).map(s => (
          <button
            key={s}
            onClick={() => handleFeedback(s)}
            disabled={!activeSession}
            className={cn(
              'text-xs px-2 py-1 rounded border transition-colors',
              prediction?.status === s ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-700',
              !activeSession ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
            )}
          >
            {statusLabelMap[s]}
          </button>
        ))}
      </div>

      {activeSession && prediction && (
        <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-gray-500" />
          <span>Now: {statusLabelMap[prediction.status]} • {prediction.minutesSinceDose}m since dose • {Math.round((prediction.phaseProgress || 0) * 100)}% through</span>
        </div>
      )}

      {/* Customization */}
      {!compact && (
        <div className="mt-3">
          <button
            onClick={() => setCustomize(v => !v)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
          >
            <Cog className="h-3.5 w-3.5" /> {customize ? 'Hide' : 'Customize'}
          </button>

          {customize && profile && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-gray-700">Onset (min)</span>
                <input type="number" min={0} className="border rounded px-2 py-1" value={onsetIn ?? 0} onChange={e => setOnsetIn(parseInt(e.target.value || '0', 10))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-700">Peak (min)</span>
                <input type="number" min={0} className="border rounded px-2 py-1" value={peakIn ?? 0} onChange={e => setPeakIn(parseInt(e.target.value || '0', 10))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-700">Wear off start (min)</span>
                <input type="number" min={0} className="border rounded px-2 py-1" value={wearIn ?? 0} onChange={e => setWearIn(parseInt(e.target.value || '0', 10))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-700">Total duration (min)</span>
                <input type="number" min={1} className="border rounded px-2 py-1" value={durationIn ?? 1} onChange={e => setDurationIn(parseInt(e.target.value || '1', 10))} />
              </label>

              <div className="col-span-2 flex items-center gap-2">
                <input id={`apply-cat-${medicationId}`} type="checkbox" checked={applyToCategory} onChange={e => setApplyToCategory(e.target.checked)} />
                <label htmlFor={`apply-cat-${medicationId}`} className="text-gray-700">Save as default for {medication.dependencyRiskCategory} category</label>
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <input id={`auto-stop-${medicationId}`} type="checkbox" checked={autoStop} onChange={e => setAutoStop(e.target.checked)} />
                <label htmlFor={`auto-stop-${medicationId}`} className="text-gray-700">Auto-stop session when worn off</label>
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    const o = Math.max(0, Number(onsetIn ?? 0));
                    const d = Math.max(1, Number(durationIn ?? 1));
                    const p = Math.min(d, Math.max(o + 1, Number(peakIn ?? o + Math.round((d - o) * 0.33))));
                    const w = Math.min(d, Math.max(p + 1, Number(wearIn ?? o + Math.round((d - o) * 0.75))));
                    updateEffectProfile(medicationId, {
                      onsetMinutes: o,
                      peakMinutes: p,
                      wearOffStartMinutes: w,
                      durationMinutes: d,
                      autoStopOnWearOff: autoStop,
                    }, applyToCategory);
                    setCustomize(false);
                  }}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => resetEffectProfileToDefault(medicationId)}
                  className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Reset to default
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


