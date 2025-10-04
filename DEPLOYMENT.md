# Meditrax Deployment Guide

Complete guide for building and deploying Meditrax across all platforms.

---

## 🚀 Quick Deploy

### Web (GitHub Pages)
```bash
npm run deploy
```

### Android
```bash
npm run android:dev  # Opens Android Studio
# Then: Build → Generate Signed AAB
```

### iOS (macOS only)
```bash
# First time: Install CocoaPods
sudo gem install cocoapods

# Install dependencies
cd ios/App && pod install && cd ../..

# Open Xcode
open ios/App/App.xcworkspace

# Build and run in Xcode
```

### Desktop (Electron)
```bash
cd electron
npm run electron:pack  # Package for current OS
```

---

## 📱 Platform Setup

### iOS Requirements
- macOS with Xcode 14.1+
- CocoaPods: `sudo gem install cocoapods`
- Run: `cd ios/App && pod install`
- **Important**: Open `App.xcworkspace` not `App.xcodeproj`

### Android Requirements
- Android Studio
- Java JDK 11+
- Android SDK 24+

### Electron
- No special requirements
- Builds on any OS

---

## 🎨 iOS Live Activities (Optional)

Complete Swift UI code provided in `ios_live_activity_code/` folder.

**Setup (15 minutes):**
1. Open Xcode: `npm run cap:ios`
2. File → New → Target → Widget Extension
3. Name: `MeditraxLiveActivity`, ✅ Include Live Activity
4. Copy Swift files from `ios_live_activity_code/`
5. Add to Info.plist:
   ```xml
   <key>NSSupportsLiveActivities</key>
   <true/>
   ```
6. Build and run on device (iOS 16.2+)

See `ios_live_activity_code/IMPLEMENTATION_GUIDE.md` for details.

---

## 🌐 Web/PWA Features

**What Works:**
- ✅ Offline caching via service worker
- ✅ Install to home screen
- ✅ Web notifications (immediate only)
- ✅ All core features

**Limitations:**
- ❌ No scheduled notifications (use native apps)
- ❌ No biometric, camera, haptics
- ❌ No background tracking

**Recommendation**: Install native app for full features.

---

## 🔧 Troubleshooting

### Xcode: "Can't run app"
```bash
sudo gem install cocoapods
cd ios/App && pod install
open App.xcworkspace  # Not .xcodeproj!
```

### PWA: "Notifications not supported"
- Fixed! Rebuild: `npm run build:web && npm run deploy`
- Now uses Web Notification API on web platforms

### Android: Build fails
```bash
npm run build:mobile
# Clean in Android Studio: Build → Clean Project
```

---

## 📊 Build Commands

```bash
# Development
npm run dev              # Web dev server

# Production
npm run build:web        # Web PWA
npm run build:capacitor  # Native apps
npm run deploy           # GitHub Pages

# Platform specific
npm run ios:dev          # Xcode
npm run android:dev      # Android Studio
npm run electron:dev     # Electron app
```

---

## ✅ Deployment Checklist

**Web:**
- [ ] `npm run deploy`
- [ ] Test at GitHub Pages URL
- [ ] Verify PWA installs
- [ ] Test notifications

**iOS:**
- [ ] pod install
- [ ] Configure signing in Xcode
- [ ] Archive → Distribute to TestFlight
- [ ] Submit to App Store

**Android:**
- [ ] Generate signed AAB
- [ ] Upload to Play Console
- [ ] Submit for review

---

For full implementation details, see the README.md

