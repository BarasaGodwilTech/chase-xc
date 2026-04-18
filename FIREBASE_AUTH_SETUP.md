# Firebase Authentication Setup Guide

This guide will help you configure Firebase Authentication for the Chase x Records website.

## Prerequisites
- Firebase project already created (chase-x-records)
- Firebase config already set up in `scripts/firebase-init.js`

## Step 1: Enable Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `chase-x-records`
3. In the left sidebar, click on **Build** → **Authentication**
4. Click **Get Started** to enable Authentication

## Step 2: Enable Sign-in Providers

### Email/Password Provider
1. In the Authentication page, click on the **Sign-in method** tab
2. Click on **Email/Password**
3. Enable the provider by toggling the switch
4. Click **Save**

### Google Sign-in Provider (Optional but Recommended)
1. In the Sign-in method tab, click on **Google**
2. Enable the provider by toggling the switch
3. Enter a project support email (this will be shown to users)
4. Click **Save**

## Step 3: Configure Authorized Domains

1. In the Authentication page, go to **Settings** (gear icon)
2. Scroll to **Authorized domains**
3. Add your production domain (e.g., `yourdomain.com`)
4. Add your development domain (e.g., `localhost`)
5. Click **Add**

## Step 4: Test the Authentication

### Testing Email/Password Sign-up
1. Open `auth.html` in your browser
2. Click "Sign up" to create a new account
3. Enter your name, email, and password
4. Click "Create Account"
5. Verify the account is created in Firebase Console → Authentication → Users

### Testing Login
1. On `auth.html`, enter the email and password you just created
2. Click "Sign In"
3. You should be redirected back to the page you came from

### Testing Conditional Login Flow
1. Go to `index.html`
2. Click on a membership plan (e.g., "Monthly Pro")
3. If you're not logged in, you should be redirected to `auth.html`
4. After logging in, you should be redirected back to `index.html`
5. Click the plan again - the payment modal should now open

## Step 5: Configure Firestore Security Rules (Optional)

Update your Firestore rules to restrict access based on authentication:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to authenticated users
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

## Step 6: Customize Email Templates (Optional)

1. In Firebase Console → Authentication → Templates
2. Customize the email verification, password reset, and email change confirmation emails
3. Add your branding and custom messaging

## Troubleshooting

### "auth/operation-not-allowed" Error
- Ensure the sign-in provider is enabled in Firebase Console
- Check that you've saved the provider settings

### "auth/unauthorized-domain" Error
- Add your domain to the authorized domains list in Firebase Console
- For local development, ensure `localhost` is added

### Redirect Not Working After Login
- Check browser console for errors
- Ensure sessionStorage is enabled in your browser
- Verify the redirect URL is being stored correctly

## Security Best Practices

1. **Enable Email Verification**: Require users to verify their email addresses
2. **Set Password Requirements**: Enforce strong passwords (minimum 6 characters)
3. **Monitor User Activity**: Regularly check the Users tab in Firebase Console
4. **Use Firebase Security Rules**: Protect your Firestore data with proper rules
5. **Enable App Check**: Protect your app from abuse and unauthorized access

## Next Steps

Once authentication is working, you can:
- Add user profile management
- Implement role-based access control
- Connect authentication to Firestore for personalized content
- Add social login providers (Facebook, Twitter, etc.)
- Implement email verification flow
