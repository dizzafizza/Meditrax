# MedTrack PWA Setup Guide

## Overview

MedTrack is a Progressive Web App (PWA) that provides native app-like functionality including push notifications, offline access, and installable app experience across all platforms.

## Features Implemented

### ✅ Core PWA Features
- **Service Worker**: Handles caching, offline functionality, and push notifications
- **Web App Manifest**: Defines app metadata for installation
- **Offline Support**: App works without internet connection
- **Install Prompts**: Browser-native installation dialogs

### ✅ Push Notifications
- **Cross-Platform Support**: Works on iOS 16.4+, Android, and desktop browsers
- **Interactive Notifications**: Actions for "Take", "Snooze", and "Skip"
- **Automatic Scheduling**: Integrates with existing reminder system
- **Permission Management**: Handles notification permissions gracefully
- **Background Processing**: Works even when app is closed

### ✅ Settings Integration
- **Notification Controls**: Toggle push notifications, sound, vibration
- **PWA Status**: Shows installation and connection status
- **Permission Testing**: Built-in notification testing
- **Theme & Display**: App appearance preferences

## Installation Instructions

### For End Users

#### Mobile Installation (iOS/Android)
1. **Open in Browser**: Visit the MedTrack website in Safari (iOS) or Chrome (Android)
2. **Add to Home Screen**: 
   - **iOS**: Tap the Share button → "Add to Home Screen"
   - **Android**: Tap menu → "Add to Home Screen" or look for install prompt
3. **Complete Installation**: Follow the prompts to install
4. **Launch App**: Open from home screen like any native app

#### Desktop Installation
1. **Open in Browser**: Use Chrome, Edge, or Safari
2. **Install Prompt**: Look for install icon in address bar or browser menu
3. **Install App**: Click "Install" and follow prompts
4. **Desktop Access**: Launch from Applications folder or desktop

### For Developers

#### Local Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

#### PWA Configuration
The PWA is configured via `vite.config.ts`:

```typescript
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}'],
        runtimeCaching: [/* ... */]
      },
      manifest: {
        name: 'MedTrack - Medication Tracker',
        short_name: 'MedTrack',
        // ... other manifest options
      }
    })
  ]
})
```

## Push Notifications Setup

### Browser Requirements
- **iOS Safari**: iOS 16.4+ (PWA must be installed to home screen)
- **Android Chrome**: All versions with PWA support
- **Desktop Chrome/Edge**: All recent versions
- **Desktop Safari**: macOS 13+ (limited support)

### Implementation Details

#### Service Worker Registration
```javascript
// Automatically registered in main.tsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => console.log('SW registered'))
    .catch(error => console.log('SW registration failed'));
}
```

#### Notification Service Integration
```typescript
// Schedule notification for medication reminder
await notificationService.scheduleReminder(reminder, medication);

// Handle notification actions
// - Take medication
// - Snooze for 15 minutes  
// - Skip dose
```

### Permission Flow
1. **Initial Request**: User enables notifications in Settings
2. **Browser Permission**: System shows native permission dialog
3. **Push Subscription**: App subscribes to push service if granted
4. **Background Scheduling**: Notifications scheduled automatically

## Troubleshooting

### Common Issues

#### Notifications Not Working
1. **Check Permission**: Go to Settings → Notifications → Check status
2. **Test Function**: Use "Send Test Notification" button
3. **Browser Settings**: Verify notifications enabled in browser
4. **PWA Installation**: Some features require app to be installed

#### PWA Not Installing
1. **HTTPS Required**: Ensure site is served over HTTPS
2. **Manifest Valid**: Check browser dev tools for manifest errors
3. **Service Worker**: Verify service worker is registered successfully
4. **Browser Support**: Confirm browser supports PWA installation

#### Offline Functionality
1. **Service Worker Active**: Check in browser dev tools
2. **Cache Status**: Verify resources are cached properly
3. **Network Tab**: Test offline mode in dev tools

### iOS Specific Notes
- **Installation Required**: Push notifications only work for installed PWAs
- **Safari Only**: Must use Safari browser for installation
- **iOS 16.4+**: Earlier versions don't support web push notifications
- **Add to Home Screen**: Required for full PWA functionality

### Android Specific Notes
- **Chrome Recommended**: Best experience with Chrome browser
- **Automatic Prompts**: Install prompts may appear automatically
- **Background Restrictions**: Some devices may limit background notifications

## Development Notes

### File Structure
```
src/
├── services/
│   ├── notificationService.ts    # Main notification logic
├── hooks/
│   ├── useNotificationHandler.ts # React hook for notifications
├── pages/
│   └── Settings.tsx             # PWA settings UI
public/
├── manifest.json               # PWA manifest
├── sw.js                      # Service worker
└── icons/                     # PWA icons
```

### Key Components
- **NotificationService**: Handles push notification logic
- **Service Worker**: Manages caching and push events
- **Settings Page**: User interface for PWA controls
- **Notification Hook**: React integration for service worker events

### Building & Deployment
```bash
# Production build with PWA assets
npm run build

# Generated PWA files:
# - dist/sw.js (service worker)
# - dist/manifest.webmanifest
# - dist/registerSW.js
```

## Testing

### Manual Testing Checklist
- [ ] PWA installs correctly on mobile/desktop
- [ ] Notifications permission request works
- [ ] Test notification sends successfully  
- [ ] Scheduled medication reminders arrive on time
- [ ] Notification actions (take/snooze/skip) function properly
- [ ] App works offline with cached data
- [ ] Online/offline status updates correctly
- [ ] Service worker updates automatically

### Browser Testing
Test on multiple browsers and devices:
- iOS Safari (iPhone/iPad)
- Android Chrome
- Desktop Chrome
- Desktop Edge  
- Desktop Safari (macOS)

## Future Enhancements

### Planned Features
- [ ] Firebase Cloud Messaging integration
- [ ] Rich notification content with images
- [ ] Advanced scheduling options
- [ ] Apple Health / Google Fit integration
- [ ] Wearable device notifications

### Technical Improvements  
- [ ] Background sync for offline actions
- [ ] Push notification analytics
- [ ] A/B testing for notification copy
- [ ] Advanced caching strategies

## Support

For PWA-related issues:
1. Check browser console for errors
2. Verify service worker status in dev tools
3. Test notification permissions manually
4. Try installing/reinstalling the PWA
5. Clear browser cache and data if needed

The PWA functionality is designed to degrade gracefully - if push notifications aren't available, the app still functions normally with in-app reminders.
