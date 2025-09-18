/**
 * Global Console Capture Service
 * Persists console logs across page navigation in PWA
 */

export interface CapturedLog {
  timestamp: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
}

class ConsoleCapture {
  private isCapturing = false;
  private originalConsole: any = {};
  private logs: CapturedLog[] = [];
  private readonly STORAGE_KEY = 'debug_console_logs';
  private readonly MAX_LOGS = 100;

  constructor() {
    this.loadLogsFromStorage();
    this.restoreFromStorage();
  }

  private loadLogsFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load console logs from storage:', error);
    }
  }

  private saveLogsToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.warn('Failed to save console logs to storage:', error);
    }
  }

  private restoreFromStorage(): void {
    const enabled = localStorage.getItem('console_capture_enabled') === 'true';
    if (enabled && !this.isCapturing) {
      this.startCapture();
    }
  }

  startCapture(): void {
    if (this.isCapturing) return;

    // Store original console methods
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    const captureLog = (type: 'log' | 'error' | 'warn' | 'info') => (...args: any[]) => {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Add to logs array
      this.logs.push({ timestamp, type, message });
      
      // Keep only last MAX_LOGS entries
      if (this.logs.length > this.MAX_LOGS) {
        this.logs = this.logs.slice(-this.MAX_LOGS);
      }
      
      // Save to storage
      this.saveLogsToStorage();
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('console-log-captured', {
        detail: { timestamp, type, message }
      }));

      // Call original console method
      this.originalConsole[type](...args);
    };

    console.log = captureLog('log');
    console.error = captureLog('error');
    console.warn = captureLog('warn');
    console.info = captureLog('info');

    this.isCapturing = true;
    localStorage.setItem('console_capture_enabled', 'true');
  }

  stopCapture(): void {
    if (!this.isCapturing) return;

    // Restore original console methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;

    this.isCapturing = false;
    localStorage.setItem('console_capture_enabled', 'false');
  }

  isActive(): boolean {
    return this.isCapturing;
  }

  getLogs(): CapturedLog[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
    this.saveLogsToStorage();
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('console-logs-cleared'));
  }

  toggle(): boolean {
    if (this.isCapturing) {
      this.stopCapture();
    } else {
      this.startCapture();
    }
    return this.isCapturing;
  }
}

// Global singleton instance
export const consoleCapture = new ConsoleCapture();
