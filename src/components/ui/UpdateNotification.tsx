import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';

interface UpdateNotificationProps {
  isVisible: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function UpdateNotification({ isVisible, onUpdate, onDismiss }: UpdateNotificationProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      onUpdate();
    } catch (error) {
      console.error('Failed to update app:', error);
      setIsUpdating(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm animate-slide-in-right">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Download className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            Update Available
          </p>
          <p className="text-xs text-blue-100 mt-1">
            A new version of the app is ready to install. Update now for the latest features and improvements.
          </p>
        </div>
        
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-blue-200 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="flex-1 bg-white text-blue-600 px-3 py-2 rounded text-sm font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Updating...
            </>
          ) : (
            'Update Now'
          )}
        </button>
        
        <button
          onClick={onDismiss}
          className="px-3 py-2 text-blue-200 hover:text-white text-sm font-medium transition-colors"
        >
          Later
        </button>
      </div>
    </div>
  );
}

// Hook to manage update notification state
export function useUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateCallback, setUpdateCallback] = useState<(() => void) | null>(null);

  const showUpdateNotification = (callback: () => void) => {
    setUpdateCallback(() => callback);
    setShowUpdate(true);
  };

  const handleUpdate = () => {
    if (updateCallback) {
      updateCallback();
    }
    setShowUpdate(false);
  };

  const handleDismiss = () => {
    setShowUpdate(false);
    setUpdateCallback(null);
  };

  // Auto-hide after 30 seconds if not interacted with
  useEffect(() => {
    if (showUpdate) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [showUpdate]);

  return {
    showUpdate,
    showUpdateNotification,
    handleUpdate,
    handleDismiss,
  };
}
