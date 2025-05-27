# Firebase & NextAuth Setup Guide

This guide will help you set up Firebase Firestore database and NextAuth with Google authentication for your reservation system.

## Prerequisites

1. Google account
2. Firebase project
3. Google Cloud Console access

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Enter project name (e.g., "reservation-system")
4. Enable Google Analytics (optional)
5. Create project

## Step 2: Enable Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" for development
4. Select a location closest to your users
5. Click "Done"

## Step 3: Enable Authentication

1. Go to "Authentication" in Firebase Console
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Google" provider
5. Set project support email
6. Note down the Web client ID for later

## Step 4: Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" app (</>) icon
4. Register your app with a nickname
5. Copy the Firebase configuration object

## Step 5: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your Firebase project
3. Go to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth 2.0 Client IDs"
5. Choose "Web application"
6. Add authorized origins: `http://localhost:3000`
7. Add authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
8. Save and copy Client ID and Client Secret

## Step 6: Create Service Account

1. In Firebase Console, go to Project Settings > Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Keep this file secure - never commit it to version control

## Step 7: Environment Variables

Create a `.env.local` file in your project root:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here-generate-a-random-string

# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Firebase Client Config
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin Config
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n"
```

### Getting Environment Values

- **NEXTAUTH_SECRET**: Generate using `openssl rand -base64 32` or any random string generator
- **GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET**: From Google Cloud Console OAuth credentials
- **Firebase Config**: From Firebase project settings > General tab
- **Service Account**: From the downloaded JSON file

## Step 8: Firestore Security Rules (Optional for Development)

For development, you can use these test rules in Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.token.email == userId;
    }
    
    // Allow authenticated users to create reservations
    match /reservations/{reservationId} {
      allow read, write: if request.auth != null;
    }
    
    // Allow admin users full access
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role == "admin";
    }
  }
}
```

## Step 9: Run the Application

1. Install dependencies: `pnpm install`
2. Start development server: `pnpm dev`
3. Visit `http://localhost:3000`
4. Click "Sign In" and authenticate with Google

## Step 10: Create Admin User

After first login:

1. Go to Firebase Console > Firestore Database
2. Find your user document in the `users` collection
3. Edit the document and change `role` from "user" to "admin"
4. Refresh your application - you should now see admin features

## Troubleshooting

### Common Issues

1. **"Module not found" errors**: Run `pnpm install` to ensure all dependencies are installed
2. **Authentication not working**: Check that all environment variables are set correctly
3. **Firestore permission denied**: Ensure security rules allow your operations
4. **Google OAuth redirect error**: Verify redirect URIs in Google Cloud Console match exactly

### Useful Commands

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Security Notes

- Never commit `.env.local` or service account JSON files to version control
- Use production-ready security rules for Firestore in production
- Regularly rotate your service account keys
- Use environment-specific configurations for different deployment environments

## Features Implemented

- ✅ Google OAuth authentication with NextAuth
- ✅ Firestore database integration
- ✅ User role management (admin/user)
- ✅ Protected routes with middleware
- ✅ Real-time data sync with Firestore
- ✅ Automatic user document creation
- ✅ Session management
- ✅ Responsive UI with modern design

Your reservation system now has a robust authentication system and cloud database!
