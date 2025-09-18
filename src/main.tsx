import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './index.css'

// Service Worker Registration with Update Detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('✅ Service Worker registered successfully:', registration);
        
        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            console.log('🔄 New service worker found, installing...');
            
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker installed, show update notification
                console.log('📋 New service worker installed, prompting user to update');
                showUpdateAvailableNotification();
              } else if (newWorker.state === 'activated') {
                console.log('✅ New service worker activated');
                newWorker.postMessage({ type: 'SW_ACTIVATED' });
                
                // Refresh the page to get latest content
                if (!navigator.serviceWorker.controller) {
                  window.location.reload();
                }
              }
            });
          }
        });

        // Handle controlling service worker change
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('🔄 Service worker controller changed, reloading...');
          window.location.reload();
        });
        
        // Notify active service worker
        if (registration.active) {
          registration.active.postMessage({ type: 'SW_ACTIVATED' });
        }
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });

  // Listen for messages from service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data) {
      switch (event.data.type) {
        case 'CACHE_UPDATED':
          console.log('📋 Cache updated, new content available');
          break;
        case 'OFFLINE_FALLBACK':
          console.log('📴 App running in offline mode');
          break;
      }
    }
  });
}

// Global function to show update notification
function showUpdateAvailableNotification() {
  const handleUpdate = () => {
    console.log('🔄 User chose to update app');
    // Skip waiting and activate new service worker immediately
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        // Fallback: just reload the page
        window.location.reload();
      }
    });
  };

  // Try to use React-based notification first
  if ((window as any).showAppUpdateNotification) {
    (window as any).showAppUpdateNotification(handleUpdate);
  } else {
    // Fallback to browser confirm dialog
    console.log('🔄 React notification not available, using fallback');
    if (window.confirm) {
      const shouldUpdate = window.confirm(
        'A new version of the app is available. Would you like to update now? This will refresh the page.'
      );
      
      if (shouldUpdate) {
        handleUpdate();
      }
    } else {
      // Last resort: automatic update
      console.log('🔄 No user interaction available - updating automatically');
      setTimeout(handleUpdate, 2000);
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </HashRouter>
  </React.StrictMode>,
)
