/**
 * Secret UI Sequence Tracker for Admin Panel Access
 * Monitors UI click patterns and triggers admin authentication
 * Now integrated with advanced security service
 */

interface SequenceElement {
  element: string;
  timestamp: number;
  coordinates?: { x: number; y: number };
}

interface AdminAuthResponse {
  success: boolean;
  token?: string;
  message?: string;
}

class SecretSequenceTracker {
  private sequence: SequenceElement[] = [];
  private readonly maxSequenceLength = 12;
  private readonly sequenceTimeout = 10000; // 10 seconds timeout
  private readonly baseUrl: string;
  private isListening = false;
  private onAdminAccessCallback?: (token: string) => void;

  // Define trackable UI elements
  private readonly trackableElements = new Map<string, string>([
    // Header elements
    ['[data-testid="header-logo"]', 'header-logo'],
    ['[data-testid="header-settings"]', 'header-settings'],
    ['[data-testid="header-notifications"]', 'header-notifications'],
    
    // Sidebar elements  
    ['[data-testid="sidebar-dashboard"]', 'sidebar-dashboard'],
    ['[data-testid="sidebar-medications"]', 'sidebar-medications'],
    ['[data-testid="sidebar-calendar"]', 'sidebar-calendar'],
    ['[data-testid="sidebar-reminders"]', 'sidebar-reminders'],
    ['[data-testid="sidebar-analytics"]', 'sidebar-analytics'],
    ['[data-testid="sidebar-reports"]', 'sidebar-reports'],
    ['[data-testid="sidebar-settings"]', 'sidebar-settings'],
    
    // Footer elements
    ['[data-testid="footer-privacy"]', 'footer-privacy'],
    ['[data-testid="footer-help"]', 'footer-help'],
    
    // Modal elements
    ['[data-testid="modal-close"]', 'modal-close'],
    
    // Action buttons
    ['[data-testid="search-button"]', 'search-button'],
    ['[data-testid="export-button"]', 'export-button'],
    
    // Special elements for admin sequences
    ['[data-admin="sequence-trigger"]', 'sequence-trigger']
  ]);

  constructor() {
    this.baseUrl = import.meta.env.VITE_ANONYMOUS_API_URL || 'http://localhost:3001/api';
    this.startListening();
  }

  /**
   * Start listening for UI clicks
   */
  private startListening(): void {
    if (this.isListening) return;

    document.addEventListener('click', this.handleClick.bind(this), true);
    this.isListening = true;
    
    console.debug('🔐 Secret sequence tracker initialized');
  }

  /**
   * Stop listening for UI clicks
   */
  public stopListening(): void {
    document.removeEventListener('click', this.handleClick.bind(this), true);
    this.isListening = false;
    this.sequence = [];
  }

  /**
   * Handle click events and track sequence
   */
  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const elementKey = this.identifyElement(target);
    
    if (!elementKey) return;

    const now = Date.now();
    
    // Clean up old sequence elements (older than timeout)
    this.sequence = this.sequence.filter(
      item => now - item.timestamp < this.sequenceTimeout
    );

    // Add new element to sequence
    const sequenceElement: SequenceElement = {
      element: elementKey,
      timestamp: now,
      coordinates: {
        x: event.clientX,
        y: event.clientY
      }
    };

    this.sequence.push(sequenceElement);

    // Limit sequence length
    if (this.sequence.length > this.maxSequenceLength) {
      this.sequence = this.sequence.slice(-this.maxSequenceLength);
    }

    // Check for admin sequence patterns
    this.checkForAdminSequence();
  }

  /**
   * Identify the trackable element from the click target
   */
  private identifyElement(target: HTMLElement): string | null {
    // Check the target element and its parents for trackable elements
    let currentElement: HTMLElement | null = target;
    
    while (currentElement && currentElement !== document.body) {
      for (const [selector, key] of this.trackableElements) {
        if (currentElement.matches && currentElement.matches(selector)) {
          return key;
        }
        
        // Also check for data attributes
        if (currentElement.dataset.sequence) {
          return currentElement.dataset.sequence;
        }
      }
      
      currentElement = currentElement.parentElement;
    }

    return null;
  }

  /**
   * Check if current sequence matches any admin patterns
   */
  private async checkForAdminSequence(): Promise<void> {
    if (this.sequence.length < 5) return; // Minimum sequence length

    // Extract just the element names
    const elementNames = this.sequence.map(item => item.element);

    // Known admin sequences (these would be configurable in production)
    const knownSequences = [
      // Development sequence
      ['header-logo', 'sidebar-settings', 'sidebar-medications', 'sidebar-calendar', 'sidebar-dashboard', 'header-logo'],
      
      // Research access sequence  
      ['sidebar-analytics', 'sidebar-reports', 'header-settings', 'footer-privacy', 'sidebar-analytics'],
      
      // Emergency admin sequence
      ['header-logo', 'header-logo', 'sidebar-settings', 'sidebar-settings', 'footer-help'],
      
      // Super admin sequence
      ['header-settings', 'sidebar-dashboard', 'sidebar-medications', 'sidebar-calendar', 'sidebar-reminders', 'sidebar-analytics', 'sidebar-reports']
    ];

    // Check if current sequence matches any known pattern
    for (const knownSequence of knownSequences) {
      if (this.sequenceMatches(elementNames, knownSequence)) {
        console.debug('🔑 Admin sequence detected:', knownSequence.join(' → '));
        await this.attemptAdminAuthentication(elementNames);
        break;
      }
    }
  }

  /**
   * Check if current sequence matches a known pattern
   */
  private sequenceMatches(current: string[], pattern: string[]): boolean {
    if (current.length < pattern.length) return false;

    // Check if the last N elements match the pattern
    const relevantSequence = current.slice(-pattern.length);
    return relevantSequence.every((element, index) => element === pattern[index]);
  }

  /**
   * Attempt admin authentication with the detected sequence
   */
  private async attemptAdminAuthentication(sequence: string[]): Promise<void> {
    try {
      console.debug('🔐 Attempting admin authentication...');

      // Use advanced security service for validation
      const clientInfo = {
        userAgent: navigator.userAgent,
        ipAddress: 'client-ip', // In production, this would be handled server-side
        timestamp: Date.now()
      };

      const securityResult = securityService.validateSequence(sequence, clientInfo);

      if (securityResult.valid && securityResult.token) {
        console.log('✅ Admin access granted with security validation');
        console.log(`🛡️ Security confidence: ${(securityResult.confidence * 100).toFixed(1)}%`);
        console.log(`⚠️ Risk score: ${(securityResult.riskScore * 100).toFixed(1)}%`);
        
        // Store admin token securely
        sessionStorage.setItem('admin_token', securityResult.token);
        
        // Clear sequence after successful auth
        this.sequence = [];
        
        // Trigger admin panel access
        if (this.onAdminAccessCallback) {
          this.onAdminAccessCallback(securityResult.token);
        }
        
        // Show discrete notification with security info
        this.showDiscreteNotification(
          `Admin access granted (${(securityResult.confidence * 100).toFixed(0)}% confidence)`, 
          'success'
        );
        
      } else {
        console.warn('❌ Admin authentication failed - security validation failed');
        this.showDiscreteNotification('Access denied - security check failed', 'error');
        
        // Clear sequence on failed attempt
        this.sequence = [];
      }

      // Fallback to API if security service fails and we're not in dev mode
      if (!securityResult.valid && !import.meta.env.DEV) {
        try {
          const response = await fetch(`${this.baseUrl}/admin/auth/sequence`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sequence })
          });

          const result: AdminAuthResponse = await response.json();

          if (result.success && result.token) {
            sessionStorage.setItem('admin_token', result.token);
            this.sequence = [];
            
            if (this.onAdminAccessCallback) {
              this.onAdminAccessCallback(result.token);
            }
            
            this.showDiscreteNotification('Admin access granted (API fallback)', 'success');
          }
        } catch (apiError) {
          console.error('API authentication fallback failed:', apiError);
        }
      }

    } catch (error) {
      console.error('Admin authentication error:', error);
      this.showDiscreteNotification('Authentication error', 'error');
    }
  }

  /**
   * Show discrete notification that doesn't reveal admin functionality
   */
  private showDiscreteNotification(message: string, type: 'success' | 'error'): void {
    // Create a subtle notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg text-sm z-50 transition-opacity duration-300 ${
      type === 'success' 
        ? 'bg-green-100 text-green-800 border border-green-200' 
        : 'bg-red-100 text-red-800 border border-red-200'
    }`;
    notification.textContent = message;
    notification.style.opacity = '0';

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 100);

    // Animate out and remove
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 2000);
  }

  /**
   * Set callback for when admin access is granted
   */
  public onAdminAccess(callback: (token: string) => void): void {
    this.onAdminAccessCallback = callback;
  }

  /**
   * Check if admin token exists and is valid
   */
  public async checkAdminSession(): Promise<boolean> {
    const token = sessionStorage.getItem('admin_token');
    if (!token) return false;

    try {
      // Use security service for token validation
      const validation = securityService.validateToken(token);
      
      if (validation.valid) {
        console.debug('🔐 Admin session valid via security service');
        return true;
      } else {
        console.debug('❌ Admin token invalid:', validation.error);
        sessionStorage.removeItem('admin_token');
        return false;
      }
    } catch (error) {
      console.error('Session validation error:', error);
      sessionStorage.removeItem('admin_token');
      return false;
    }
  }

  /**
   * Logout admin session
   */
  public logoutAdmin(): void {
    sessionStorage.removeItem('admin_token');
    this.sequence = [];
    console.log('🔐 Admin session ended');
  }

  /**
   * Get current admin token
   */
  public getAdminToken(): string | null {
    return sessionStorage.getItem('admin_token');
  }

  /**
   * Get sequence status for debugging (development only)
   */
  public getSequenceStatus(): { 
    currentSequence: string[]; 
    sequenceLength: number; 
    lastElement?: string;
    timeRemaining?: number;
    securityInfo?: any;
  } {
    const now = Date.now();
    const lastElement = this.sequence[this.sequence.length - 1];
    
    const status = {
      currentSequence: this.sequence.map(s => s.element),
      sequenceLength: this.sequence.length,
      lastElement: lastElement?.element,
      timeRemaining: lastElement ? this.sequenceTimeout - (now - lastElement.timestamp) : 0
    };

    // Add security info in development mode
    if (import.meta.env.DEV && this.sequence.length > 0) {
      const securityDashboard = securityService.getSecurityDashboard();
      (status as any).securityInfo = {
        threatLevel: securityDashboard.threatLevel,
        riskScore: securityDashboard.riskScore,
        activeSessions: securityDashboard.activeSessions,
        recentEvents: securityDashboard.recentEvents.length
      };
    }
    
    return status;
  }

  /**
   * Manually trigger sequence check (for testing)
   */
  public manualSequenceTrigger(elements: string[]): void {
    if (import.meta.env.DEV) {
      console.debug('🧪 Manual sequence trigger:', elements);
      this.attemptAdminAuthentication(elements);
    }
  }
}

// Export singleton instance
export const secretSequenceTracker = new SecretSequenceTracker();
