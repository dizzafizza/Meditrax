import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './index.css'

// Development console welcome message
if (import.meta.env.DEV) {
  console.log('%c🏥 MedTrack - Enterprise Medical Analytics Platform', 'color: #3b82f6; font-size: 16px; font-weight: bold;');
  console.log('%c🚀 ADVANCED ADMIN PANEL - FULLY FUNCTIONAL & SECURE!', 'color: #10b981; font-size: 14px; font-weight: bold;');
  console.log('%c🔐 Enterprise Security Features:', 'color: #6b7280; font-size: 12px; font-weight: bold;');
  console.log('%c  • AES-256 Encryption • JWT Tokens • Rate Limiting • Audit Logging', 'color: #374151; font-size: 10px;');
  console.log('%c📊 Advanced Analytics Engine:', 'color: #6b7280; font-size: 12px; font-weight: bold;');
  console.log('%c  • ML Predictions • Real-time Monitoring • Statistical Analysis • Data Visualization', 'color: #374151; font-size: 10px;');
  console.log('%c⚡ Quick Access Methods:', 'color: #f59e0b; font-size: 12px; font-weight: bold;');
  console.log('%c  • adminHelpers.enterAdmin() - Instant access', 'color: #374151; font-size: 11px;');
  console.log('%c  • Ctrl+Alt+A - Quick shortcut', 'color: #374151; font-size: 11px;');
  console.log('%c  • Ctrl+Shift+Alt+A - Emergency access', 'color: #374151; font-size: 11px;');
  console.log('%c🎯 UI Sequence (Advanced):', 'color: #6b7280; font-size: 12px;');
  console.log('%c  Click: Logo → Settings → Medications → Calendar → Dashboard → Logo', 'color: #374151; font-size: 10px;');
  console.log('%c🎉 Features: 6 Admin Tabs • Security Center • ML Insights • Real-time Monitoring', 'color: #8b5cf6; font-size: 11px; font-weight: bold;');
  console.log('%c💎 ENTERPRISE READY - Type "adminHelpers.enterAdmin()" now!', 'color: #f59e0b; font-size: 13px; font-weight: bold;');
  console.log('');
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
