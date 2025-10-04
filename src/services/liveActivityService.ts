/**
 * Live Activity Service
 * Interface for iOS Live Activities (requires native implementation)
 * 
 * NOTE: This service provides the TypeScript interface.
 * Native Swift code must be implemented in Xcode for Live Activities to work.
 * See: ios/App/MeditraxLiveActivity/ (to be created in Xcode)
 */

import { EffectSession, EffectStatus, EffectProfile, Medication } from '@/types';
import { isIOS, isNative } from '@/utils/platform';
import { Capacitor } from '@capacitor/core';

export interface LiveActivityState {
  medicationName: string;
  medicationDosage: string;
  currentPhase: EffectStatus;
  minutesElapsed: number;
  onsetMinutes: number;
  peakMinutes: number;
  wearOffMinutes: number;
  durationMinutes: number;
  progress: number; // 0-100
  phaseDescription: string;
}

class LiveActivityService {
  private activeLiveActivities: Map<string, string> = new Map(); // sessionId -> activityId
  private readonly STORAGE_KEY = 'meditrax_live_activities';

  /**
   * Check if Live Activities are supported
   * Requires iOS 16.1+ and native app
   */
  async isSupported(): Promise<boolean> {
    if (!isIOS() || !isNative()) {
      return false;
    }

    // Check iOS version
    try {
      const version = await this.getIOSVersion();
      return version >= 16.1;
    } catch {
      return false;
    }
  }

  /**
   * Get iOS version
   */
  private async getIOSVersion(): Promise<number> {
    // This would need to be implemented via a native plugin
    // For now, assume iOS 16+ if on iOS native
    return 16.2;
  }

  /**
   * Start a Live Activity for an effect tracking session
   */
  async startLiveActivity(
    session: EffectSession,
    medication: Medication,
    profile: EffectProfile
  ): Promise<string | null> {
    if (!(await this.isSupported())) {
      console.log('Live Activities not supported on this device');
      return null;
    }

    try {
      const activityState: LiveActivityState = {
        medicationName: medication.name,
        medicationDosage: `${medication.dosage} ${medication.unit || ''}`,
        currentPhase: 'pre_onset',
        minutesElapsed: 0,
        onsetMinutes: profile.onsetMinutes,
        peakMinutes: profile.peakMinutes,
        wearOffMinutes: profile.wearOffStartMinutes,
        durationMinutes: profile.durationMinutes,
        progress: 0,
        phaseDescription: 'Starting...',
      };

      // Call native plugin (to be implemented)
      const activityId = await this.callNativeStartLiveActivity(session.id, activityState);
      
      if (activityId) {
        this.activeLiveActivities.set(session.id, activityId);
        this.saveLiveActivities();
        console.log(`✅ Started Live Activity for ${medication.name}`);
        return activityId;
      }

      return null;
    } catch (error) {
      console.error('Failed to start Live Activity:', error);
      return null;
    }
  }

  /**
   * Update a Live Activity with current effect status
   */
  async updateLiveActivity(
    sessionId: string,
    status: EffectStatus,
    minutesElapsed: number,
    profile: EffectProfile,
    medication: Medication
  ): Promise<void> {
    const activityId = this.activeLiveActivities.get(sessionId);
    if (!activityId) {
      console.warn(`No Live Activity found for session ${sessionId}`);
      return;
    }

    try {
      const progress = (minutesElapsed / profile.durationMinutes) * 100;
      const phaseDescription = this.getPhaseDescription(status, minutesElapsed, profile);

      const activityState: LiveActivityState = {
        medicationName: medication.name,
        medicationDosage: `${medication.dosage} ${medication.unit || ''}`,
        currentPhase: status,
        minutesElapsed,
        onsetMinutes: profile.onsetMinutes,
        peakMinutes: profile.peakMinutes,
        wearOffMinutes: profile.wearOffStartMinutes,
        durationMinutes: profile.durationMinutes,
        progress: Math.min(100, Math.max(0, progress)),
        phaseDescription,
      };

      await this.callNativeUpdateLiveActivity(activityId, activityState);
      console.log(`✅ Updated Live Activity: ${status} at ${minutesElapsed}min`);
    } catch (error) {
      console.error('Failed to update Live Activity:', error);
    }
  }

  /**
   * End a Live Activity
   */
  async endLiveActivity(sessionId: string): Promise<void> {
    const activityId = this.activeLiveActivities.get(sessionId);
    if (!activityId) return;

    try {
      await this.callNativeEndLiveActivity(activityId);
      this.activeLiveActivities.delete(sessionId);
      this.saveLiveActivities();
      console.log(`✅ Ended Live Activity`);
    } catch (error) {
      console.error('Failed to end Live Activity:', error);
    }
  }

  /**
   * Get phase description for display
   */
  private getPhaseDescription(status: EffectStatus, elapsed: number, profile: EffectProfile): string {
    switch (status) {
      case 'pre_onset':
        const untilOnset = profile.onsetMinutes - elapsed;
        return `Onset in ${Math.max(0, untilOnset)} min`;
      case 'kicking_in':
        const untilPeak = profile.peakMinutes - elapsed;
        return `Peak in ${Math.max(0, untilPeak)} min`;
      case 'peaking':
        const untilWear = profile.wearOffStartMinutes - elapsed;
        return `Wear-off in ${Math.max(0, untilWear)} min`;
      case 'wearing_off':
        const untilEnd = profile.durationMinutes - elapsed;
        return `Ending in ${Math.max(0, untilEnd)} min`;
      case 'worn_off':
        return 'Effects complete';
      default:
        return 'Tracking...';
    }
  }

  /**
   * Save active Live Activities to storage
   */
  private saveLiveActivities(): void {
    try {
      const data = Array.from(this.activeLiveActivities.entries());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save Live Activities:', error);
    }
  }

  /**
   * Restore active Live Activities from storage
   */
  private restoreLiveActivities(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.activeLiveActivities = new Map(data);
      }
    } catch (error) {
      console.error('Failed to restore Live Activities:', error);
    }
  }

  /**
   * Native plugin calls via Capacitor bridge to Swift code
   * Communicates with LiveActivityPlugin.swift in iOS project
   */
  
  private async callNativeStartLiveActivity(sessionId: string, state: LiveActivityState): Promise<string | null> {
    try {
      const LiveActivity = (Capacitor.Plugins as any).LiveActivity;
      
      if (!LiveActivity) {
        console.warn('LiveActivity plugin not available');
        return null;
      }

      const result = await LiveActivity.start({
        sessionId,
        state: {
          medicationId: state.medicationName, // Map to expected format
          medicationName: state.medicationName,
          medicationDosage: state.medicationDosage,
          medicationColor: '#3b82f6', // Default blue
          currentPhase: state.currentPhase,
          minutesElapsed: state.minutesElapsed,
          progress: state.progress / 100, // Convert to 0-1 range
          phaseDescription: state.phaseDescription,
          onsetMinutes: state.onsetMinutes,
          peakMinutes: state.peakMinutes,
          wearOffMinutes: state.wearOffMinutes,
          durationMinutes: state.durationMinutes,
        },
      });

      console.log('✅ Native Live Activity started:', result);
      return result.activityId || result.sessionId;
    } catch (error) {
      console.warn('Native Live Activity start failed (fallback mode):', error);
      // Return mock ID for web/non-iOS platforms
      return null;
    }
  }

  private async callNativeUpdateLiveActivity(activityId: string, state: LiveActivityState): Promise<void> {
    try {
      const LiveActivity = (Capacitor.Plugins as any).LiveActivity;
      
      if (!LiveActivity) {
        return;
      }

      // Find session ID from activity ID
      let sessionId = activityId;
      for (const [sid, aid] of this.activeLiveActivities.entries()) {
        if (aid === activityId) {
          sessionId = sid;
          break;
        }
      }

      await LiveActivity.update({
        sessionId,
        state: {
          medicationName: state.medicationName,
          medicationDosage: state.medicationDosage,
          medicationColor: '#3b82f6',
          currentPhase: state.currentPhase,
          minutesElapsed: state.minutesElapsed,
          progress: state.progress / 100,
          phaseDescription: state.phaseDescription,
          onsetMinutes: state.onsetMinutes,
          peakMinutes: state.peakMinutes,
          wearOffMinutes: state.wearOffMinutes,
          durationMinutes: state.durationMinutes,
        },
      });

      console.log('✅ Native Live Activity updated');
    } catch (error) {
      // Silent fail for non-iOS platforms
      console.debug('Live Activity update skipped:', error);
    }
  }

  private async callNativeEndLiveActivity(activityId: string): Promise<void> {
    try {
      const LiveActivity = (Capacitor.Plugins as any).LiveActivity;
      
      if (!LiveActivity) {
        return;
      }

      // Find session ID from activity ID
      let sessionId = activityId;
      for (const [sid, aid] of this.activeLiveActivities.entries()) {
        if (aid === activityId) {
          sessionId = sid;
          break;
        }
      }

      await LiveActivity.end({ sessionId });
      console.log('✅ Native Live Activity ended');
    } catch (error) {
      console.debug('Live Activity end skipped:', error);
    }
  }

  constructor() {
    this.restoreLiveActivities();
  }
}

export const liveActivityService = new LiveActivityService();
export default liveActivityService;

