/**
 * Backend Sync Service - Simplified for Capacitor
 * Local-only storage, no Firebase Cloud Functions
 */

class BackendSyncService {
  private isInitialized = false;
  private readonly USER_ID_KEY = 'meditrax_user_id';

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('📦 Backend sync service initialized (local-only mode)');
    this.isInitialized = true;
  }

  /**
   * Get or generate a consistent user ID for local storage
   */
  getUserId(): string {
    let userId = localStorage.getItem(this.USER_ID_KEY);
    
    if (!userId) {
      userId = this.generateUserId();
      localStorage.setItem(this.USER_ID_KEY, userId);
    }

    return userId;
  }

  /**
   * Generate a unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Sync data (no-op in local-only mode)
   */
  async syncData(data: any): Promise<void> {
    console.log('📦 Data sync (local-only mode, no remote sync)');
    // No remote sync in Capacitor local-only mode
    // All data is stored in Zustand with localStorage persistence
  }
}

export const backendSyncService = new BackendSyncService();
export default backendSyncService;
