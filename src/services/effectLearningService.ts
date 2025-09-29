import { EffectEvent, EffectProfile, EffectStatus, Medication } from '@/types';
import { MEDICATION_DATABASE, MedicationDatabaseEntry } from '@/services/medicationDatabase';

/**
 * EffectLearningService
 * - Predicts onset/peak/wear-off phases for a medication dose
 * - Learns per-user metabolism from feedback events and updates the profile
 */
export class EffectLearningService {
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
    const category = (medication.dependencyRiskCategory || 'low-risk').toLowerCase();

    let onset = 30; // minutes
    let duration = 480;

    if (category.includes('stimulant')) {
      onset = 20; duration = 360;
    } else if (category.includes('opioid')) {
      onset = 30; duration = 480;
    } else if (category.includes('benzodiazepine')) {
      onset = 30; duration = 720;
    } else if (category.includes('sleep-aid') || category.includes('muscle-relaxant')) {
      onset = 30; duration = 600;
    } else if (medication.category === 'supplement' || medication.category === 'vitamin' || medication.category === 'herbal') {
      onset = 30; duration = 360;
    }

    const peak = Math.round(onset + (duration - onset) * 0.33);
    const wearOffStart = Math.round(onset + (duration - onset) * 0.75);

    return {
      medicationId: medication.id,
      onsetMinutes: onset,
      peakMinutes: peak,
      wearOffStartMinutes: wearOffStart,
      durationMinutes: duration,
      confidence: 0.2,
      samples: 0,
      lastUpdated: new Date(),
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

    const { onsetAvgMin, totalAvgMin } = parsed;
    const onset = Math.max(0, Math.round(onsetAvgMin));
    const duration = Math.max(1, Math.round(totalAvgMin));
    const peak = Math.round(onset + (duration - onset) * 0.33);
    const wearOffStart = Math.round(onset + (duration - onset) * 0.75);

    return {
      medicationId: medication.id,
      onsetMinutes: onset,
      peakMinutes: peak,
      wearOffStartMinutes: wearOffStart,
      durationMinutes: duration,
      confidence: 0.35,
      samples: 0,
      lastUpdated: new Date(),
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
    const { onsetMinutes, peakMinutes, wearOffStartMinutes, durationMinutes } = profile;
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

  /**
   * Update profile from a single feedback event using adaptive EMA
   */
  static updateProfileFromEvent(profile: EffectProfile, event: EffectEvent): EffectProfile {
    const alpha = Math.max(0.1, 0.6 / (profile.samples + 1));

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const safe = (n: number) => (isFinite(n) && !isNaN(n) ? n : 0);

    let { onsetMinutes, peakMinutes, wearOffStartMinutes, durationMinutes } = profile;

    switch (event.status) {
      case 'kicking_in':
        onsetMinutes = (1 - alpha) * onsetMinutes + alpha * safe(event.offsetMinutes);
        break;
      case 'peaking':
        peakMinutes = (1 - alpha) * peakMinutes + alpha * safe(event.offsetMinutes);
        break;
      case 'wearing_off':
        wearOffStartMinutes = (1 - alpha) * wearOffStartMinutes + alpha * safe(event.offsetMinutes);
        break;
      case 'worn_off':
        durationMinutes = (1 - alpha) * durationMinutes + alpha * safe(event.offsetMinutes);
        break;
    }

    // Enforce ordering constraints: onset < peak < wearOffStart < duration
    onsetMinutes = clamp(onsetMinutes, 1, 24 * 60);
    peakMinutes = Math.max( onsetsMargin(onsetMinutes), peakMinutes );
    wearOffStartMinutes = Math.max( peakMargin(peakMinutes), wearOffStartMinutes );
    durationMinutes = Math.max( wearOffMargin(wearOffStartMinutes), durationMinutes );

    function onsetsMargin(onset: number) { return onset + 10; }
    function peakMargin(peak: number) { return peak + 10; }
    function wearOffMargin(wear: number) { return wear + 10; }

    const samples = profile.samples + 1;
    const confidence = Math.min(1, 0.2 + samples / 10);

    return {
      ...profile,
      onsetMinutes: Math.round(onsetMinutes),
      peakMinutes: Math.round(Math.max(onsetMinutes + 5, peakMinutes)),
      wearOffStartMinutes: Math.round(Math.max(peakMinutes + 5, wearOffStartMinutes)),
      durationMinutes: Math.round(Math.max(wearOffStartMinutes + 5, durationMinutes)),
      samples,
      confidence,
      lastUpdated: new Date(),
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


