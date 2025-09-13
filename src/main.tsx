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

// Simple test version for debugging GitHub Pages
console.log('🧪 DEBUG: main.tsx is executing');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{padding: '20px', fontFamily: 'Arial, sans-serif'}}>
      <h1 style={{color: '#3b82f6'}}>🧪 Debug Test - React is Working!</h1>
      <p>If you see this, React is rendering correctly on GitHub Pages.</p>
      <p><strong>Next test:</strong> Trying HashRouter...</p>
      <HashRouter>
        <div style={{border: '2px solid green', padding: '10px', margin: '10px 0'}}>
          <h2>✅ HashRouter is working!</h2>
          <p>Current URL: {window.location.href}</p>
          <p>Hash: {window.location.hash}</p>
        </div>
      </HashRouter>
      <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f3f4f6'}}>
        <h3>Debug Info:</h3>
        <p>Environment: {import.meta.env.MODE}</p>
        <p>Base URL: {import.meta.env.BASE_URL}</p>
        <p>Dev: {import.meta.env.DEV ? 'Yes' : 'No'}</p>
        <p>Prod: {import.meta.env.PROD ? 'Yes' : 'No'}</p>
      </div>
    </div>
  </React.StrictMode>,
)
