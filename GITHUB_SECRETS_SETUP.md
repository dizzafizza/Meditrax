# GitHub Secrets Setup for MedTrack

This guide explains how to set up GitHub Secrets for Firebase integration and automatic deployment to GitHub Pages.

## 🔐 Required GitHub Secrets

You need to configure the following secrets in your GitHub repository:

### Firebase Configuration Secrets

1. **VITE_FIREBASE_API_KEY**: Your Firebase project's API key
2. **VITE_FIREBASE_AUTH_DOMAIN**: Your Firebase auth domain (usually `yourproject.firebaseapp.com`)  
3. **VITE_FIREBASE_PROJECT_ID**: Your Firebase project ID
4. **VITE_FIREBASE_STORAGE_BUCKET**: Your Firebase storage bucket (usually `yourproject.appspot.com`)
5. **VITE_FIREBASE_MESSAGING_SENDER_ID**: Your Firebase messaging sender ID (numeric)
6. **VITE_FIREBASE_APP_ID**: Your Firebase app ID 
7. **VITE_FIREBASE_MEASUREMENT_ID**: Your Firebase/Google Analytics measurement ID (optional)
8. **VITE_FIREBASE_VAPID_KEY**: Your Firebase Web Push certificate VAPID key

## 🛠️ How to Set Up GitHub Secrets

### Step 1: Navigate to Repository Settings
1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** > **Actions**

### Step 2: Add Each Secret
1. Click **New repository secret**
2. Enter the **Name** (exactly as listed above)
3. Enter the **Value** (the actual Firebase configuration value)
4. Click **Add secret**
5. Repeat for all 8 secrets

### Step 3: Verify Setup
After adding all secrets, you should see them listed in the repository secrets section.

## 🔥 Getting Firebase Configuration Values

### From Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the **Settings gear** > **Project settings**
4. In the **General** tab, scroll to **Your apps** section
5. Click on your web app or **Add app** if you haven't created one
6. Copy the configuration values from the `firebaseConfig` object

### For VAPID Key:
1. In Firebase Console, go to **Project settings**
2. Click **Cloud Messaging** tab
3. In **Web configuration** section, generate or copy your **Web Push certificates** key
4. This is your `VITE_FIREBASE_VAPID_KEY`

## 🚀 Automatic Deployment

Once secrets are configured:

1. **Automatic Builds**: Every push to `main` branch triggers a build and deployment
2. **Pull Request Builds**: PRs are built but not deployed (for testing)
3. **Manual Deployment**: You can trigger deployments manually from the Actions tab

## 🧪 Development vs Production

### Development (Local)
- Uses `.env` file if present
- Falls back gracefully if Firebase config is missing
- Shows warnings about missing configuration
- Local notifications work without Firebase

### Production (GitHub Pages)
- Uses GitHub Secrets for Firebase configuration
- Full Firebase Cloud Messaging support
- iOS PWA push notifications enabled
- Optimized for production performance

## 📱 iOS PWA Push Notifications

With GitHub Secrets properly configured:
- ✅ Firebase Cloud Messaging provides reliable iOS PWA notifications
- ✅ Background notifications work when app is closed
- ✅ Foreground message handling
- ✅ Service worker push notification fallback

## 🔍 Troubleshooting

### Build Fails
- Verify all 8 secrets are added with correct names (case-sensitive)
- Check Firebase project is active and billing is enabled
- Ensure VAPID key is from the Web Push certificates section

### Notifications Don't Work
- Verify `VITE_FIREBASE_VAPID_KEY` matches your Firebase Web Push certificate
- Check that Firebase project has Cloud Messaging enabled
- Ensure your domain is added to Firebase authorized domains

### Deployment Issues  
- Check GitHub Pages is enabled in repository settings
- Verify GitHub Actions have proper permissions
- Review build logs in the Actions tab

## 🎯 Benefits of GitHub Secrets

- **Security**: No sensitive data in your repository
- **Automatic Deployment**: Push to deploy without manual builds
- **Environment Separation**: Different configs for dev/prod
- **Team Collaboration**: Secrets managed centrally
- **iOS PWA Support**: Production-ready push notifications

---

**Need Help?** Check the GitHub Actions logs or Firebase Console for detailed error messages.
