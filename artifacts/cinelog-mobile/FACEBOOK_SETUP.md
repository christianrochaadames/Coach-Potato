# Facebook Integration Setup Guide

All the code for Facebook Login (SSO) and friends discovery is already in the app.  
Follow these steps to activate both features.

---

## Step 1 — Create a Facebook Developer App

1. Go to **[developers.facebook.com](https://developers.facebook.com)** and sign in.
2. Click **My Apps → Create App**.
3. Choose **Consumer** as the app type.
4. Fill in an app name (e.g. "CouchPotato") and your contact email, then click **Create App**.

---

## Step 2 — Add the iOS Bundle ID

1. In your new app's dashboard, click **Settings → Basic**.
2. Scroll down to **iOS**, click **Add Platform** (if not already shown).
3. Set **Bundle ID** to `com.couchpotato.ios`.
4. Set **iPhone Store ID** when you have an App Store listing (optional for dev).
5. Click **Save Changes**.

---

## Step 3 — Enable the Friends List permission

For friends discovery to return results, the "user_friends" permission must be added:

1. In your app dashboard, go to **App Review → Permissions and Features**.
2. Find **user_friends** and request it (or leave it in development mode for testing — it works for users added as testers without a full review).

---

## Step 4 — Note your App ID

On the **Settings → Basic** page, copy the **App ID** (a long number like `123456789012345`).

---

## Step 5 — Set the Replit environment secret

In the Replit Shell, run:

```bash
# Or use the Replit Secrets panel (🔒 icon in the sidebar)
echo "Add EXPO_PUBLIC_FACEBOOK_APP_ID=<your_app_id> to Replit Secrets"
```

The secret name must be exactly: **`EXPO_PUBLIC_FACEBOOK_APP_ID`**

Once set, the "Connect Facebook" button in the Profile tab will go live and friends discovery will work.

---

## Step 6 — Enable Facebook Login in Clerk

The Facebook sign-in button on the login screen uses Clerk's OAuth.  
Clerk needs to be told about your Facebook App:

1. Open the **[Clerk Dashboard](https://dashboard.clerk.com)** and select your CouchPotato application.
2. Go to **User & Authentication → Social Connections**.
3. Find **Facebook** and click the toggle to enable it.
4. Enter your **App ID** and **App Secret** (from Facebook → Settings → Basic).
5. Click **Save**.

Once saved, the "Continue with Facebook" button on the sign-in screen will work for real users.

---

## What each secret unlocks

| Secret / setting | What it enables |
|---|---|
| `EXPO_PUBLIC_FACEBOOK_APP_ID` | Friends discovery in Profile → Social tab |
| Facebook enabled in Clerk dashboard | "Continue with Facebook" on the sign-in screen |

---

## Testing without full App Review

While your Facebook App is in development mode, only users you've added as **testers or developers** at developers.facebook.com → Roles → Test Users can use the integration. This is fine for internal testing before App Store submission.

For production, you'll need Facebook App Review approval for `user_friends`. The review process takes roughly 1–2 weeks.

---

## Redirect URI (already configured)

The OAuth redirect is handled by `AuthSession.makeRedirectUri({ scheme: 'couchpotato' })`.  
The app's URL scheme (`couchpotato://`) is already registered in `app.json`. No additional changes needed.
