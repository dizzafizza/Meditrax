# GitHub Secrets Setup for GitHub Pages Deployment

This document explains how to set up GitHub Secrets for building the application with Firebase configuration for GitHub Pages deployment.

## Required GitHub Secrets

### Firebase Configuration (Frontend)
These secrets are used to build the frontend with proper Firebase configuration:

- `VITE_FIREBASE_API_KEY` - Your Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Your Firebase auth domain (e.g., `your-project.firebaseapp.com`)
- `VITE_FIREBASE_PROJECT_ID` - Your Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Your Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Your Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Your Firebase app ID
- `VITE_FIREBASE_VAPID_KEY` - Your Firebase VAPID key for push notifications
- `VITE_FIREBASE_MEASUREMENT_ID` - Your Firebase measurement ID (optional)

**Note**: This project uses GitHub Pages for hosting, not Firebase Hosting. The Firebase configuration is only needed for the frontend build process.

## Setting Up GitHub Secrets

### Step 1: Get Firebase Configuration

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your Firebase project
3. Go to **Project Settings** (gear icon)
4. Scroll down to **Your apps** section
5. Click on your web app or create one if it doesn't exist
6. Copy the configuration values

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** for each of the following:

   - **Name**: `VITE_FIREBASE_API_KEY`
     **Value**: Your Firebase API key
   
   - **Name**: `VITE_FIREBASE_AUTH_DOMAIN`
     **Value**: Your Firebase auth domain (e.g., `your-project.firebaseapp.com`)
   
   - **Name**: `VITE_FIREBASE_PROJECT_ID`
     **Value**: Your Firebase project ID
   
   - **Name**: `VITE_FIREBASE_STORAGE_BUCKET`
     **Value**: Your Firebase storage bucket
   
   - **Name**: `VITE_FIREBASE_MESSAGING_SENDER_ID`
     **Value**: Your Firebase messaging sender ID
   
   - **Name**: `VITE_FIREBASE_APP_ID`
     **Value**: Your Firebase app ID
   
   - **Name**: `VITE_FIREBASE_VAPID_KEY`
     **Value**: Your Firebase VAPID key (for push notifications)

### Step 3: Enable GitHub Pages

1. Go to your GitHub repository
2. Navigate to **Settings** > **Pages**
3. Under **Source**, select **GitHub Actions**
4. The deployment will happen automatically when you push to the main branch

## Benefits of This Setup

✅ **Modern GitHub Pages deployment** - Uses official GitHub Actions for Pages  
✅ **Secure** - Firebase secrets are only used during build, not stored in deployment  
✅ **Automatic deployment** - Deploys on every push to main branch  
✅ **No external dependencies** - Uses GitHub's native Pages infrastructure  

## Troubleshooting

### "Input required and not supplied: firebaseServiceAccount" error
- **Root Cause**: This error occurs when using Firebase deployment actions instead of GitHub Pages
- **Solution**: The workflow has been updated to use GitHub Pages deployment instead of Firebase Hosting
- **Note**: This project uses GitHub Pages, not Firebase Hosting

### Build fails with missing environment variables
- Ensure all required Firebase secrets are set in GitHub repository settings
- Check that secret names match exactly (case-sensitive)
- Verify the Firebase project configuration is correct

### GitHub Pages deployment fails
- Check that GitHub Pages is enabled in repository settings
- Ensure the source is set to "GitHub Actions"
- Verify the workflow has the correct permissions (pages: write, id-token: write)

### Local development
For local development, create a `.env.local` file with your Firebase configuration:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

Then run:
```bash
npm run dev
```
