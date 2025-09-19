# GitHub Secrets Setup for Firebase Deployment

This document explains how to set up GitHub Secrets for secure Firebase deployment without using deprecated authentication methods.

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

### Firebase Service Account (Backend)
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Service account JSON key for Firebase Functions deployment

## Setting Up Service Account Authentication

### Step 1: Create a Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **IAM & Admin** > **Service Accounts**
4. Click **Create Service Account**
5. Name it `firebase-github-actions` (or similar)
6. Add the following roles:
   - **Firebase Admin**
   - **Cloud Functions Admin**
   - **Artifact Registry Administrator**
   - **Cloud Scheduler Admin**

### Step 2: Generate Service Account Key

1. Click on the created service account
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Choose **JSON** format
5. Download the JSON file

### Step 3: Add to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_SERVICE_ACCOUNT_KEY`
5. Value: Copy the entire contents of the downloaded JSON file

### Step 4: Add Firebase Project ID

1. Create another secret named `FIREBASE_PROJECT_ID`
2. Value: Your Firebase project ID (same as `VITE_FIREBASE_PROJECT_ID`)

## Benefits of This Setup

✅ **No deprecated warnings** - Uses modern service account authentication  
✅ **Secure** - No tokens in deployment logs  
✅ **Automatic cleanup** - Sets up container image cleanup policy  
✅ **Proper permissions** - Service account has only necessary permissions  

## Troubleshooting

### "Failed to authenticate" error
- Ensure the service account JSON is properly formatted
- Verify the service account has the required roles
- Check that `FIREBASE_PROJECT_ID` secret matches your actual project ID

### "Cleanup policy setup failed" error
- This is non-critical and won't prevent deployment
- The workflow will continue even if cleanup policy setup fails
- You can manually set it up later using the Firebase CLI

### Functions deployment fails
- Check that the service account has **Cloud Functions Admin** role
- Verify the project ID is correct
- Ensure the functions build successfully locally

## Local Development

For local development, you can still use `firebase login`:

```bash
firebase login
firebase use your-project-id
```

The service account setup is only required for CI/CD deployments.
