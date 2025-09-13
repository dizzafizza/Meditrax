import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { secretSequenceTracker } from '@/services/secretSequenceTracker';

/**
 * Hidden admin integration component
 * Manages secret admin panel access without revealing its existence
 */
export function AdminIntegration() {
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  useEffect(() => {
    // Check for existing admin session on component mount
    checkExistingSession();

    // Set up admin access callback
    secretSequenceTracker.onAdminAccess(() => {
      setIsAdminAuthenticated(true);
      setShowAdminPanel(true);
    });

    // Development helpers (only in dev mode)
    if (import.meta.env.DEV) {
      // Add global admin helpers for development
      (window as any).adminHelpers = {
        checkSequence: () => secretSequenceTracker.getSequenceStatus(),
        triggerSequence: (elements: string[]) => secretSequenceTracker.manualSequenceTrigger(elements),
        showPanel: () => setShowAdminPanel(true),
        hidePanel: () => setShowAdminPanel(false),
        logout: () => handleAdminClose(),
        // Simplified admin access
        enterAdmin: () => {
          console.log('🔐 Entering admin mode directly...');
          setIsAdminAuthenticated(true);
          setShowAdminPanel(true);
          // Store a fake token for development
          sessionStorage.setItem('admin_token', 'dev-admin-token');
        },
        // Test sequence trigger
        testSequence: () => {
          const devSequence = ['header-logo', 'sidebar-settings', 'sidebar-medications', 'sidebar-calendar', 'sidebar-dashboard', 'header-logo'];
          secretSequenceTracker.manualSequenceTrigger(devSequence);
        }
      };

      console.log('🔧 Admin helpers available in development mode:');
      console.log('- adminHelpers.enterAdmin() - Direct admin access (simplified)');
      console.log('- adminHelpers.testSequence() - Test default sequence');
      console.log('- adminHelpers.checkSequence() - Check current sequence');
      console.log('- adminHelpers.triggerSequence([...]) - Manually trigger sequence');
      console.log('- adminHelpers.showPanel() - Show admin panel');
      console.log('- adminHelpers.hidePanel() - Hide admin panel');
      console.log('- adminHelpers.logout() - Logout admin');
      console.log('');
      console.log('🔑 Development sequences:');
      console.log('1. header-logo → sidebar-settings → sidebar-medications → sidebar-calendar → sidebar-dashboard → header-logo');
      console.log('2. sidebar-analytics → sidebar-reports → header-settings → footer-privacy → sidebar-analytics');
      console.log('');
      console.log('🚀 Quick Start: Run adminHelpers.enterAdmin() for instant access!');
    }

    return () => {
      // Cleanup on unmount
      secretSequenceTracker.stopListening();
    };
  }, []);

  const checkExistingSession = async () => {
    const hasValidSession = await secretSequenceTracker.checkAdminSession();
    if (hasValidSession) {
      setIsAdminAuthenticated(true);
    }
  };

  const handleAdminClose = () => {
    setShowAdminPanel(false);
    setIsAdminAuthenticated(false);
    secretSequenceTracker.logoutAdmin();
  };

  // Multiple keyboard shortcuts for admin access
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (import.meta.env.DEV) {
        // Primary shortcut: Ctrl+Shift+Alt+A
        if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'A') {
          console.log('🚨 Emergency admin access triggered');
          setShowAdminPanel(true);
          setIsAdminAuthenticated(true);
          sessionStorage.setItem('admin_token', 'dev-admin-token');
        }
        
        // Simple shortcut: Ctrl+Alt+A
        if (event.ctrlKey && event.altKey && event.key === 'A' && !event.shiftKey) {
          console.log('🔐 Quick admin access triggered');
          setShowAdminPanel(true);
          setIsAdminAuthenticated(true);
          sessionStorage.setItem('admin_token', 'dev-admin-token');
        }
        
        // Console shortcut: Ctrl+Shift+C (opens with admin message)
        if (event.ctrlKey && event.shiftKey && event.key === 'C') {
          console.log('💡 Admin hint: Type adminHelpers.enterAdmin() for direct access');
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <>
      {/* Admin Dashboard - Only renders when authenticated and visible */}
      {isAdminAuthenticated && (
        <AdminDashboard 
          isVisible={showAdminPanel}
          onClose={handleAdminClose}
        />
      )}

      {/* Development-only admin status indicator */}
      {import.meta.env.DEV && isAdminAuthenticated && (
        <div className="fixed bottom-4 left-4 z-40">
          <div className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg">
            🔐 Admin Mode Active
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className="ml-2 underline hover:no-underline"
            >
              {showAdminPanel ? 'Hide' : 'Show'} Panel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Higher-order component to add admin sequence tracking to UI elements
 */
export function withAdminTracking<T extends object>(
  Component: React.ComponentType<T>,
  sequenceId: string
) {
  return React.forwardRef<any, T & { 'data-testid'?: string; 'data-sequence'?: string }>((props, ref) => {
    return (
      <Component
        {...(props as T)}
        ref={ref}
        data-testid={sequenceId}
        data-sequence={sequenceId}
      />
    );
  });
}

/**
 * Hook to check if current user has admin access
 */
export function useAdminAccess() {
  const [hasAccess, setHasAccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const isValid = await secretSequenceTracker.checkAdminSession();
        setHasAccess(isValid);
      } catch (error) {
        setHasAccess(false);
      } finally {
        setChecking(false);
      }
    };

    checkAccess();
  }, []);

  return { hasAccess, checking };
}

/**
 * Component to make any element trackable for admin sequences
 */
interface AdminTrackableProps {
  sequenceId: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function AdminTrackable({ sequenceId, children, className, onClick }: AdminTrackableProps) {
  return (
    <div
      data-testid={sequenceId}
      data-sequence={sequenceId}
      className={className}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
