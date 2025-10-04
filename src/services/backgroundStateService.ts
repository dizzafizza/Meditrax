/**
 * Background State Service
 * Manages state persistence for features that need to work in the background
 */

import { EffectSession, MedicationLog } from '@/types';

class BackgroundStateService {
  private readonly EFFECT_SESSIONS_KEY = 'meditrax_background_effect_sessions';
  private readonly APP_STATE_KEY = 'meditrax_app_state';
  private readonly LAST_ACTIVE_KEY = 'meditrax_last_active';

  /**
   * Save effect sessions to persist across app lifecycle
   */
  saveEffectSessions(sessions: EffectSession[]): void {
    try {
      const data = {
        sessions,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(this.EFFECT_SESSIONS_KEY, JSON.stringify(data));
      console.log(`💾 Saved ${sessions.length} effect sessions to background state`);
    } catch (error) {
      console.error('Failed to save effect sessions:', error);
    }
  }

  /**
   * Restore effect sessions from storage
   */
  restoreEffectSessions(): EffectSession[] {
    try {
      const stored = localStorage.getItem(this.EFFECT_SESSIONS_KEY);
      if (!stored) return [];

      const data = JSON.parse(stored);
      const sessions = data.sessions || [];

      // Deserialize dates
      return sessions.map((session: any) => ({
        ...session,
        startTime: new Date(session.startTime),
        endTime: session.endTime ? new Date(session.endTime) : null,
        events: (session.events || []).map((event: any) => ({
          ...event,
          timestamp: new Date(event.timestamp),
        })),
      }));
    } catch (error) {
      console.error('Failed to restore effect sessions:', error);
      return [];
    }
  }

  /**
   * Calculate elapsed time for an effect session
   * Accounts for time when app was backgrounded
   */
  calculateElapsedTime(session: EffectSession): number {
    const now = new Date();
    const start = new Date(session.startTime);
    const elapsedMs = now.getTime() - start.getTime();
    return Math.floor(elapsedMs / (60 * 1000)); // minutes
  }

  /**
   * Update last active timestamp
   */
  updateLastActive(): void {
    try {
      localStorage.setItem(this.LAST_ACTIVE_KEY, new Date().toISOString());
    } catch (error) {
      console.error('Failed to update last active timestamp:', error);
    }
  }

  /**
   * Get time since app was last active (in minutes)
   */
  getTimeSinceLastActive(): number {
    try {
      const stored = localStorage.getItem(this.LAST_ACTIVE_KEY);
      if (!stored) return 0;

      const lastActive = new Date(stored);
      const now = new Date();
      const elapsedMs = now.getTime() - lastActive.getTime();
      return Math.floor(elapsedMs / (60 * 1000));
    } catch (error) {
      console.error('Failed to get time since last active:', error);
      return 0;
    }
  }

  /**
   * Save app state for background recovery
   */
  saveAppState(state: {
    activeEffectSessions: number;
    pendingNotifications: number;
    lastInventoryCheck?: Date;
    lastAdherenceCheck?: Date;
  }): void {
    try {
      const data = {
        ...state,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(this.APP_STATE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save app state:', error);
    }
  }

  /**
   * Restore app state
   */
  restoreAppState(): any {
    try {
      const stored = localStorage.getItem(this.APP_STATE_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored);
      return {
        ...data,
        savedAt: new Date(data.savedAt),
        lastInventoryCheck: data.lastInventoryCheck ? new Date(data.lastInventoryCheck) : undefined,
        lastAdherenceCheck: data.lastAdherenceCheck ? new Date(data.lastAdherenceCheck) : undefined,
      };
    } catch (error) {
      console.error('Failed to restore app state:', error);
      return null;
    }
  }

  /**
   * Check if a background task should run based on last execution time
   */
  shouldRunBackgroundTask(taskName: string, intervalMinutes: number): boolean {
    try {
      const key = `meditrax_last_${taskName}`;
      const stored = localStorage.getItem(key);
      
      if (!stored) {
        // Never run before
        localStorage.setItem(key, new Date().toISOString());
        return true;
      }

      const lastRun = new Date(stored);
      const now = new Date();
      const elapsedMs = now.getTime() - lastRun.getTime();
      const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

      if (elapsedMinutes >= intervalMinutes) {
        localStorage.setItem(key, new Date().toISOString());
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to check background task ${taskName}:`, error);
      return false;
    }
  }

  /**
   * Clear all background state (for troubleshooting)
   */
  clearBackgroundState(): void {
    try {
      localStorage.removeItem(this.EFFECT_SESSIONS_KEY);
      localStorage.removeItem(this.APP_STATE_KEY);
      localStorage.removeItem(this.LAST_ACTIVE_KEY);
      console.log('✅ Cleared background state');
    } catch (error) {
      console.error('Failed to clear background state:', error);
    }
  }
}

export const backgroundStateService = new BackgroundStateService();
export default backgroundStateService;

