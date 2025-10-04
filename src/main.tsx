import React from 'react'
import ReactDOM from 'react-dom/client'
import { IonReactRouter } from '@ionic/react-router'
import { Toaster } from 'react-hot-toast'
import '@ionic/react/css/core.css'
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'
import '@ionic/react/css/display.css'
import { IonApp } from '@ionic/react'
import { App as CapacitorApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { isNative, isIOS } from './utils/platform'
import App from './App.tsx'
import './index.css'
import './theme/ionic.css'

// Enable global glass theme
document.body.classList.add('glass-theme')

// Initialize Capacitor plugins for native apps
if (isNative()) {
  // Hide splash screen after app loads
  SplashScreen.hide().catch(console.error);

  // Configure status bar
  StatusBar.setStyle({ style: Style.Light }).catch(console.error);
  if (isIOS()) {
    StatusBar.setOverlaysWebView({ overlay: false }).catch(console.error);
  }

  // Handle app state changes
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    console.log('App state changed. Is active:', isActive);
  });

  // Handle back button on Android
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (!canGoBack) {
      CapacitorApp.exitApp();
    } else {
      window.history.back();
    }
  });
}

// Register service worker for PWA (web platform only)
// Capacitor native apps don't need this
if (import.meta.env.PROD && !isNative()) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('✅ PWA Service Worker registered:', registration);
        })
        .catch(error => {
          console.warn('PWA Service Worker registration failed:', error);
        });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IonApp>
      <IonReactRouter>
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
      </IonReactRouter>
    </IonApp>
  </React.StrictMode>,
)
