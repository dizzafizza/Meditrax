import { EffectEvent, EffectProfile, EffectStatus, Medication } from '@/types';
import { MEDICATION_DATABASE, MedicationDatabaseEntry } from '@/services/medicationDatabase';

/**
 * EffectLearningService
 * - Predicts onset/peak/wear-off phases for a medication dose
 * - Learns per-user metabolism from feedback events and updates the profile
 */
export class EffectLearningService {
  // Default category timings (minutes). Conservative baselines used when no per-drug data or learned category profile exists.
  private static CATEGORY_DEFAULTS: Record<string, { onset: number; duration: number }> = {
    opioid: { onset: 20, duration: 300 },
    benzodiazepine: { onset: 30, duration: 480 },
    stimulant: { onset: 30, duration: 300 },
    dissociative: { onset: 10, duration: 90 },
    alcohol: { onset: 10, duration: 120 },
    'sleep-aid': { onset: 30, duration: 480 },
    'muscle-relaxant': { onset: 30, duration: 360 },
    antidepressant: { onset: 60, duration: 480 },
    anticonvulsant: { onset: 60, duration: 600 },
    antipsychotic: { onset: 60, duration: 600 },
    'low-risk': { onset: 30, duration: 240 },

    // Medication category fallbacks
    supplement: { onset: 30, duration: 240 },
    vitamin: { onset: 30, duration: 240 },
    herbal: { onset: 30, duration: 300 },
    prescription: { onset: 30, duration: 360 },
    'over-the-counter': { onset: 30, duration: 240 },
    injection: { onset: 5, duration: 180 },
    topical: { onset: 30, duration: 240 },
    emergency: { onset: 5, duration: 120 },
    recreational: { onset: 15, duration: 180 },
  };
  /**
   * Build default profile using (priority):
   * 1) Local database (Psychonaut Wiki-derived) durations
   * 2) Category-learned profile (if provided)
   * 3) Category fallback heuristics
   */
  static getDefaultProfile(
    medication: Medication,
    categoryLearned?: EffectProfile | null
  ): EffectProfile {
    const dbProfile = this.getDefaultProfileFromDatabase(medication);
    if (dbProfile) return dbProfile;
    if (categoryLearned) {
      return { ...categoryLearned, medicationId: medication.id };
    }
    return this.getCategoryFallbackProfile(medication);
  }

  static getCategoryFallbackProfile(medication: Medication): EffectProfile {
    const depCat = (medication.dependencyRiskCategory || '').toLowerCase();
    const medCat = (medication.category || '').toLowerCase();
    const defaults = this.CATEGORY_DEFAULTS[depCat] || this.CATEGORY_DEFAULTS[medCat] || this.CATEGORY_DEFAULTS['low-risk'];
    const onset = defaults.onset;
    const duration = defaults.duration;
    const peak = Math.round(onset + (duration - onset) * 0.33);
    const wearOffStart = Math.round(onset + (duration - onset) * 0.75);

    return {
      medicationId: medication.id,
      onsetMinutes: onset,
      peakMinutes: peak,
      wearOffStartMinutes: wearOffStart,
      durationMinutes: duration,
      confidence: 0.25,
      samples: 0,
      lastUpdated: new Date(),
      autoStopOnWearOff: false,
      sigmaOnset: 10,
      sigmaPeak: 15,
      sigmaWear: 20,
      sigmaDuration: 25,
      timeOfDayBiasMinutes: { morning: 0, afternoon: 0, evening: 0, night: 0 },
    };
  }

  /**
   * Attempt to derive defaults from local medication database description text.
   */
  static getDefaultProfileFromDatabase(medication: Medication): EffectProfile | null {
    const entry = this.findDatabaseEntryForMedication(medication.name);
    if (!entry || !entry.description) return null;
    const parsed = this.extractDurationsFromText(entry.description);
    if (!parsed) return null;

    let { onsetAvgMin, totalAvgMin } = parsed;
    let onset = Math.max(0, Math.round(onsetAvgMin));
    let duration = Math.max(1, Math.round(totalAvgMin));

    // Sanity checks; fall back to category defaults if unrealistic
    const fallback = this.CATEGORY_DEFAULTS[(medication.dependencyRiskCategory || '').toLowerCase()] ||
                     this.CATEGORY_DEFAULTS[(medication.category || '').toLowerCase()] ||
                     this.CATEGORY_DEFAULTS['low-risk'];
    const violatesOrdering = duration <= onset + 15;
    const onsetTooHigh = onset > Math.max(120, duration * 0.8);
    const durationTooShort = duration < 30;
    if (violatesOrdering || onsetTooHigh || durationTooShort) {
      onset = fallback.onset;
      duration = fallback.duration;
    }
    const peak = Math.round(onset + (duration - onset) * 0.33);
    const wearOffStart = Math.round(onset + (duration - onset) * 0.75);

    return {
      medicationId: medication.id,
      onsetMinutes: onset,
      peakMinutes: peak,
      wearOffStartMinutes: wearOffStart,
      durationMinutes: duration,
      confidence: 0.4,
      samples: 0,
      lastUpdated: new Date(),
      autoStopOnWearOff: false,
      sigmaOnset: 10,
      sigmaPeak: 15,
      sigmaWear: 20,
      sigmaDuration: 25,
      timeOfDayBiasMinutes: { morning: 0, afternoon: 0, evening: 0, night: 0 },
    };
  }

  private static findDatabaseEntryForMedication(name: string): MedicationDatabaseEntry | null {
    const n = name.toLowerCase();
    const byName = MEDICATION_DATABASE.find(e => e.name.toLowerCase() === n);
    if (byName) return byName;
    const contains = MEDICATION_DATABASE.find(e => n.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(n));
    if (contains) return contains;
    const alias = MEDICATION_DATABASE.find(e =>
      (e.brandNames || []).some(b => n.includes(b.toLowerCase())) ||
      (e.genericName ? n.includes(e.genericName.toLowerCase()) : false)
    );
    return alias || null;
  }

  /**
   * Parse durations like:
   *  - "Duration: 2-4 hours onset, 3-6 hours total"
   *  - "Duration: Immediate onset, 1-5 minutes total"
   *  - "Duration: 1-2 hours insufflated" (no onset -> infer)
   */
  static extractDurationsFromText(text: string): { onsetAvgMin: number; totalAvgMin: number } | null {
    const lower = text.toLowerCase();
    if (!lower.includes('duration')) return null;

    const unitToMinutes = (value: number, unit: string) => {
      if (unit.startsWith('hour') || unit === 'h' || unit === 'hrs') return value * 60;
      return value; // minutes
    };

    const rangeAvg = (a: number, b?: number) => (typeof b === 'number' ? (a + b) / 2 : a);

    // Onset
    let onsetAvgMin: number | null = null;
    const immediate = /duration:.*?(immediate|instant)/.exec(lower);
    if (immediate) {
      onsetAvgMin = 0;
    } else {
      const onsetMatch = /([0-9]+)\s*(?:-\s*([0-9]+))?\s*(minutes|min|minute|hours|hour|h|hrs)\s*onset/.exec(lower);
      if (onsetMatch) {
        const v1 = Number(onsetMatch[1]);
        const v2 = onsetMatch[2] ? Number(onsetMatch[2]) : undefined;
        const unit = onsetMatch[3];
        onsetAvgMin = unitToMinutes(rangeAvg(v1, v2), unit);
      }
    }

    // Total duration
    let totalAvgMin: number | null = null;
    const totalMatch = /([0-9]+)\s*(?:-\s*([0-9]+))?\s*(minutes|min|minute|hours|hour|h|hrs)\s*(?:total|oral|insufflated|vaporized)?/.exec(lower);
    if (totalMatch) {
      const v1 = Number(totalMatch[1]);
      const v2 = totalMatch[2] ? Number(totalMatch[2]) : undefined;
      const unit = totalMatch[3];
      totalAvgMin = unitToMinutes(rangeAvg(v1, v2), unit);
    }

    // If we only find a single duration and not onset, assume it's total
    if (totalAvgMin == null && onsetAvgMin != null) {
      // Hard to infer total; set 4x onset as rough default
      totalAvgMin = Math.max(onsetAvgMin * 4, onsetAvgMin + 60);
    }
    if (totalAvgMin == null && onsetAvgMin == null) return null;

    // If onset missing, infer portion of total
    if (onsetAvgMin == null && totalAvgMin != null) {
      onsetAvgMin = Math.round(totalAvgMin * 0.15);
    }

    return { onsetAvgMin: onsetAvgMin!, totalAvgMin: totalAvgMin! };
  }

  /**
   * Predict current phase and progress given minutes since dose
   */
  static predictStatus(profile: EffectProfile, minutesSinceDose: number): { status: EffectStatus; phaseProgress: number } {
    let { onsetMinutes, peakMinutes, wearOffStartMinutes, durationMinutes } = profile;
    // Apply time-of-day bias as a gentle shift across phases
    const bias = this.getTimeOfDayBias(profile);
    if (bias !== 0) {
      const shift = bias;
      onsetMinutes = Math.max(0, onsetMinutes + shift);
      peakMinutes = Math.max(onsetMinutes + 1, peakMinutes + shift);
      wearOffStartMinutes = Math.max(peakMinutes + 1, wearOffStartMinutes + shift);
      durationMinutes = Math.max(wearOffStartMinutes + 1, durationMinutes + shift);
    }
    let status: EffectStatus = 'pre_onset';
    if (minutesSinceDose < 0) minutesSinceDose = 0;

    if (minutesSinceDose < onsetMinutes) {
      status = 'pre_onset';
    } else if (minutesSinceDose < peakMinutes) {
      status = 'kicking_in';
    } else if (minutesSinceDose < wearOffStartMinutes) {
      status = 'peaking';
    } else if (minutesSinceDose < durationMinutes) {
      status = 'wearing_off';
    } else {
      status = 'worn_off';
    }

    const phaseProgress = Math.min(1, Math.max(0, minutesSinceDose / Math.max(1, durationMinutes)));
    return { status, phaseProgress };
  }

  private static getTimeOfDayBias(profile: EffectProfile): number {
    const map = profile.timeOfDayBiasMinutes;
    if (!map) return 0;
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return map.morning || 0;
    if (h >= 12 && h < 18) return map.afternoon || 0;
    if (h >= 18 && h < 24) return map.evening || 0;
    return map.night || 0;
  }

  /**
   * Update profile from a single feedback event using adaptive EMA
   */
  static updateProfileFromEvent(profile: EffectProfile, event: EffectEvent): EffectProfile {
    const alphaBase = Math.max(0.08, 0.6 / (profile.samples + 1)); // decays with samples
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const safe = (n: number) => (isFinite(n) && !isNaN(n) ? n : 0);

    // Advanced anchors expressed as fraction of total duration
    const anchors = { onset: 0.15, peak: 0.33, wear: 0.75 } as const;

    // Local copies
    let { onsetMinutes, peakMinutes, wearOffStartMinutes, durationMinutes } = profile;

    // Time-of-day bias correction for observation
    const bias = this.getTimeOfDayBias(profile);
    const observed = Math.max(0, safe(event.offsetMinutes) - bias);

    // Helper to blend toward anchored estimate with a gentle factor
    const blend = (current: number, target: number, factor: number) => current * (1 - factor) + target * factor;

    // Update the directly observed boundary first with event-weighted alpha
    const eventAlphaMap: Record<Exclude<EffectStatus, 'pre_onset'>, number> = {
      kicking_in: alphaBase * 1.1,
      peaking: alphaBase * 0.9,
      wearing_off: alphaBase * 0.9,
      worn_off: alphaBase * 1.2,
    } as any;
    const evtAlpha = (eventAlphaMap as any)[event.status] ?? alphaBase;

    switch (event.status) {
      case 'kicking_in':
        onsetMinutes = blend(onsetMinutes, observed, evtAlpha);
        break;
      case 'peaking':
        peakMinutes = blend(peakMinutes, observed, evtAlpha);
        break;
      case 'wearing_off':
        wearOffStartMinutes = blend(wearOffStartMinutes, observed, evtAlpha);
        break;
      case 'worn_off':
        durationMinutes = blend(durationMinutes, observed, evtAlpha);
        break;
    }

    // Infer total duration candidates from internal ratios when we get intermediate events
    const inferDurationFrom = (observed: number, ratio: number) => observed > 0 && ratio > 0 ? observed / ratio : durationMinutes;
    const remainingFrom = (total: number, start: number) => Math.max(1, total - start);

    // Derive candidates based on which event we received
    if (event.status === 'kicking_in') {
      const dFromOnset = inferDurationFrom(onsetMinutes, anchors.onset);
      durationMinutes = blend(durationMinutes, dFromOnset, alphaBase * 0.5);
    } else if (event.status === 'peaking') {
      // Use anchor ratio to infer total if peak observed
      const dFromPeak = onsetMinutes + (peakMinutes - onsetMinutes) / Math.max(0.05, anchors.peak);
      durationMinutes = blend(durationMinutes, dFromPeak, alphaBase * 0.5);
    } else if (event.status === 'wearing_off') {
      const dFromWear = onsetMinutes + (wearOffStartMinutes - onsetMinutes) / Math.max(0.1, anchors.wear);
      durationMinutes = blend(durationMinutes, dFromWear, alphaBase * 0.6);
    }

    // After total duration estimation, softly harmonize adjacent boundaries toward anchored positions
    const harmonizeFactor = Math.max(0.06, 0.45 / (profile.samples + 1));
    const anchoredPeak = onsetMinutes + (remainingFrom(durationMinutes, onsetMinutes)) * anchors.peak;
    const anchoredWear = onsetMinutes + (remainingFrom(durationMinutes, onsetMinutes)) * anchors.wear;
    if (event.status !== 'peaking') {
      peakMinutes = blend(peakMinutes, anchoredPeak, harmonizeFactor);
    }
    if (event.status !== 'wearing_off') {
      wearOffStartMinutes = blend(wearOffStartMinutes, anchoredWear, harmonizeFactor);
    }
    if (event.status !== 'worn_off') {
      // Ensure duration respects a minimal tail after wear-off start
      const minTail = 10;
      const anchoredDuration = Math.max(wearOffStartMinutes + minTail, durationMinutes);
      durationMinutes = blend(durationMinutes, anchoredDuration, harmonizeFactor * 0.5);
    }

    // Enforce ordering constraints with minimal margins
    const margin = 5;
    onsetMinutes = clamp(onsetMinutes, 1, 24 * 60);
    peakMinutes = Math.max(onsetMinutes + margin, peakMinutes);
    wearOffStartMinutes = Math.max(peakMinutes + margin, wearOffStartMinutes);
    durationMinutes = Math.max(wearOffStartMinutes + margin, durationMinutes);

    // Outlier-aware sigma update for the observed boundary
    const err = (type: EffectStatus) => {
      if (type === 'kicking_in') return observed - onsetMinutes;
      if (type === 'peaking') return observed - peakMinutes;
      if (type === 'wearing_off') return observed - wearOffStartMinutes;
      if (type === 'worn_off') return observed - durationMinutes;
      return 0;
    };
    const beta = Math.max(0.05, 0.4 / (profile.samples + 1));
    let { sigmaOnset = 10, sigmaPeak = 15, sigmaWear = 20, sigmaDuration = 25 } = profile;
    const updateSigma = (sigma: number, e: number) => Math.sqrt((1 - beta) * sigma * sigma + beta * e * e);
    if (event.status === 'kicking_in') sigmaOnset = updateSigma(sigmaOnset, err('kicking_in'));
    if (event.status === 'peaking') sigmaPeak = updateSigma(sigmaPeak, err('peaking'));
    if (event.status === 'wearing_off') sigmaWear = updateSigma(sigmaWear, err('wearing_off'));
    if (event.status === 'worn_off') sigmaDuration = updateSigma(sigmaDuration, err('worn_off'));

    const samples = profile.samples + 1;
    // Confidence incorporates both sample count and accumulated variability
    const varPenalty = Math.min(1, (sigmaOnset + sigmaPeak + sigmaWear + sigmaDuration) / 400);
    const confidence = Math.min(1, (0.2 + samples / 10) * (1 - 0.5 * varPenalty));

    return {
      ...profile,
      onsetMinutes: Math.round(onsetMinutes),
      peakMinutes: Math.round(peakMinutes),
      wearOffStartMinutes: Math.round(wearOffStartMinutes),
      durationMinutes: Math.round(durationMinutes),
      samples,
      confidence,
      lastUpdated: new Date(),
      sigmaOnset,
      sigmaPeak,
      sigmaWear,
      sigmaDuration,
    };
  }

  /**
   * Bulk update from multiple events (order-agnostic)
   */
  static updateProfileFromEvents(profile: EffectProfile, events: EffectEvent[]): EffectProfile {
    let updated = { ...profile };
    // Sort by offset to reduce oscillation
    const sorted = [...events].sort((a, b) => a.offsetMinutes - b.offsetMinutes);
    for (const e of sorted) {
      updated = this.updateProfileFromEvent(updated, e);
    }
    return updated;
  }

  /**
   * Helpers for UI segment lengths in percentage of total duration
   */
  static getSegmentPercents(profile: EffectProfile): { onsetPct: number; peakPct: number; wearOffPct: number } {
    const total = Math.max(1, profile.durationMinutes);
    const onsetPct = Math.min(100, (profile.onsetMinutes / total) * 100);
    const peakPct = Math.min(100, ((profile.peakMinutes - profile.onsetMinutes) / total) * 100);
    const wearOffPct = Math.min(100, ((profile.wearOffStartMinutes - profile.peakMinutes) / total) * 100);
    return { onsetPct, peakPct, wearOffPct };
  }
}


