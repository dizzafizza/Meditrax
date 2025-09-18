# 🔥 Web Push Notifications Setup for iOS PWA (Using Firebase FCM)

## Overview

This guide will help you set up Web Push API using Firebase Cloud Messaging (FCM) for MedTrack to enable reliable iOS PWA push notifications. 

**Important:** 
- ✅ **Hosting**: GitHub Pages (as usual)
- ✅ **Push Notifications**: Firebase FCM (for iOS PWA compatibility)
- ❌ **Not using**: Firebase hosting, Firebase database, or other Firebase services

## 📋 **Prerequisites**

- Firebase project (free tier works)
- GitHub repository with Actions enabled  
- iOS 16.4+ device for testing
- MedTrack installed as PWA on iOS

## 🚀 **Step 1: Create Firebase Project**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or "Add project"
3. Enter project name (e.g., "medtrack-notifications")
4. Enable Google Analytics (optional)
5. Click "Create project"

## 🔧 **Step 2: Add Web App to Firebase**

1. In Firebase Console, click "Add app" → Web (</> icon)
2. Enter app nickname (e.g., "MedTrack PWA")  
3. **Do NOT check "Also set up Firebase Hosting"** (we use GitHub Pages)
4. Click "Register app"
5. **Copy the configuration values** - you'll need these!

```javascript
// Example Firebase config (copy YOUR values)
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "medtrack-notifications.firebaseapp.com",
  projectId: "medtrack-notifications",
  storageBucket: "medtrack-notifications.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdefghijklmnop",
  measurementId: "G-XXXXXXXXXX"
};
```

## 📱 **Step 3: Enable Cloud Messaging**

1. In Firebase Console → Project Settings → Cloud Messaging
2. Scroll to "Web Push certificates"
3. Click "Generate key pair" 
4. **Copy the VAPID key** - this is crucial for iOS PWA notifications!

## 🔐 **Step 4: Set Up Environment Variables**

### **For Local Development:**

Create a `.env` file in your project root:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com  
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# VAPID Key for Web Push (CRITICAL for iOS PWA)
VITE_FIREBASE_VAPID_KEY=BPxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### **For Production (GitHub Secrets):**

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each variable:

| Secret Name | Example Value | Required |
|-------------|---------------|----------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyXXXXXXXXXXXX` | ✅ Yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | `project.firebaseapp.com` | ✅ Yes |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` | ✅ Yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | `project.appspot.com` | ✅ Yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789012` | ✅ Yes |
| `VITE_FIREBASE_APP_ID` | `1:123456789012:web:abc` | ✅ Yes |
| `VITE_FIREBASE_VAPID_KEY` | `BPxxxxxxxxxx` | ✅ **Critical for iOS** |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-XXXXXXXXXX` | Optional |

## 🧪 **Step 5: Test the Setup**

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Check Firebase initialization:**
   - Open browser dev console
   - Look for: `🔥 Firebase initialized successfully`
   - Look for: `📱 Firebase messaging initialized`

3. **Test notifications in Settings:**
   - Go to Settings → Notifications  
   - Use existing "Test Immediate" and "Test in 1 min" buttons
   - Check console for Firebase initialization messages

4. **Check notification diagnostics:**
   - Expand "Notification System Status" in Settings
   - Verify: `Using Firebase: FCM`
   - Verify: `Firebase Config: Configured`
   - Note the FCM Token (you'll need this for server-side testing)

## 📱 **Step 6: iOS PWA Testing**

### **Install as PWA on iOS:**
1. Open MedTrack in Safari on iOS 16.4+
2. Tap Share button → "Add to Home Screen"
3. Tap "Add" to install
4. **Launch from home screen icon** (not Safari!)

### **Grant Notification Permission:**
1. In the installed PWA, go to Settings
2. Test notifications to trigger permission prompt
3. **Important:** Grant permission within the PWA, not Safari

### **Test Push Notifications:**
1. Use the "Test Immediate" button in Settings
2. Try scheduling medication reminders  
3. Close the app and wait for notifications

## 🔍 **Troubleshooting**

### **Common Issues:**

**❌ "Firebase messaging not supported"**
- Check iOS version (16.4+ required)
- Ensure app is launched from home screen icon
- Verify app is installed as PWA, not just bookmarked

**❌ "Firebase configuration incomplete"**
- Check all environment variables are set
- Verify VAPID key is correct and complete  
- Check browser console for specific missing values

**❌ "Failed to get FCM token"**
- Ensure notification permission is granted
- Check VAPID key is valid
- Try refreshing the page and re-granting permission

**❌ "Notifications only work when app is open"**
- This means FCM background messaging isn't working
- Verify service worker registration
- Check Firebase configuration in service worker
- Ensure VAPID key is set correctly

### **Debugging Steps:**

1. **Check Console Messages:**
   ```
   🔥 Firebase initialized successfully  
   📱 Firebase messaging initialized
   🔑 FCM token obtained successfully
   ```

2. **Verify Settings Diagnostics:**
   - Using Firebase: FCM ✅
   - Firebase Config: Configured ✅  
   - FCM Subscription: Active ✅

3. **Test Notification Flow:**
   - Test immediate notifications first
   - Then test scheduled notifications
   - Finally test closed-app delivery

## 🚀 **Step 7: Deploy to GitHub Pages**

1. **Ensure all GitHub secrets are set** (see Step 4)

2. **Deploy to GitHub Pages:**
   ```bash
   npm run build
   npm run deploy  # Deploys to GitHub Pages
   ```

3. **Test production deployment:**
   - Install PWA from your GitHub Pages URL  
   - Test push notifications with existing buttons
   - Verify closed-app delivery works

## 📊 **Success Metrics**

When everything is working correctly, you should see:

✅ **Firebase initialized successfully**  
✅ **FCM token obtained**  
✅ **Test notifications work immediately**  
✅ **Scheduled notifications work when app closed**  
✅ **iOS PWA receives notifications when app is not active**

## 💡 **Pro Tips for iOS PWA Notifications**

1. **Always test on iOS 16.4+** - earlier versions don't support web push
2. **Install as PWA** - notifications won't work in Safari browser
3. **Launch from home screen** - launching from Safari disables PWA features
4. **Grant permission within PWA** - permission granted in Safari won't carry over
5. **Use Firebase FCM** - it's more reliable than custom VAPID implementations
6. **Test closed-app delivery** - this is the main benefit of proper push notifications

## 🆘 **Need Help?**

If you're still having issues:

1. Check the browser console for error messages
2. Use the Firebase console to test sending messages directly
3. Verify your FCM token in the Settings diagnostics  
4. Test on multiple iOS devices if possible
5. Check Firebase project settings and permissions

Remember: iOS PWA push notifications can be finicky, but with proper Firebase setup, they work reliably! 🎉
