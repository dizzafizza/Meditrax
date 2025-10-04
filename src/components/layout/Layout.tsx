/**
 * @deprecated This component is no longer used in v2.0.
 * Navigation is now handled by the Ionic shell in App.tsx (IonSplitPane + IonMenu + IonTabs).
 * This file is kept for reference only.
 */

import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  // This component is deprecated and not used in the Ionic-based UI
  console.warn('Layout component is deprecated. Use Ionic navigation in App.tsx instead.');
  
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
