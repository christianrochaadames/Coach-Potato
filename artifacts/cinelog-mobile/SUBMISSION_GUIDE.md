# CouchPotato — App Store Submission Guide

Everything here is a one-time setup. Once done, future releases are just `eas build` + `eas submit`.

---

## Before you start

You need:
- An **Apple Developer account** (developer.apple.com — $99/yr)
- An **Expo account** (expo.dev — free)
- Access to the Replit Shell **or** a terminal on your own Mac/PC

---

## Step 1 — Log in to EAS (one-time)

Open the Replit Shell and run:

```bash
cd artifacts/cinelog-mobile
npx eas-cli@latest login
```

Enter your Expo username and password when prompted.

---

## Step 2 — Create the App Store listing (one-time)

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **+** → **New App**
3. Fill in:
   - Platform: **iOS**
   - Name: **CouchPotato**
   - Bundle ID: **com.couchpotato.ios** ← register this first at developer.apple.com → Identifiers
   - SKU: `couchpotato-ios` (any unique string)
4. Save — Apple will assign an **App ID number** (you'll need it for `eas submit` later)

**Privacy policy URL** (required by Apple):
```
https://<your-deployed-web-app-domain>/cinelog/privacy
```
The `/privacy` page is already live on the web app. Use its deployed URL.

> 📋 See `STORE_LISTING.md` in this directory for ready-to-paste description, keywords, age rating answers, and a full submission checklist.

---

## Step 3 — Trigger your first production build

```bash
cd artifacts/cinelog-mobile
npx eas-cli@latest build --platform ios --profile production
```

- EAS will ask to log in to your Apple Developer account the first time (to handle signing certificates automatically — say yes to all prompts)
- The build runs on Expo's cloud servers (~15–20 min)
- You'll get an email when it's done

---

## Step 4 — Submit to TestFlight / App Store

After the build finishes:

```bash
npx eas-cli@latest submit --platform ios --profile production
```

On first run it'll ask for:
- Your Apple ID email
- Your App Store Connect App ID (the number from Step 2)
- Your Apple Team ID (10 characters, found at developer.apple.com → Membership)

The build will appear in **TestFlight** within minutes. You can test it there before submitting for App Store review.

---

## Step 5 — App Store review

1. In App Store Connect, go to your app → **+** next to iOS App
2. Select the build from TestFlight
3. Fill in screenshots (you need 6.5" and 5.5" iPhone sizes), description, keywords, age rating
4. Click **Submit for Review** — Apple typically reviews within 24–48 hours

---

## Future releases

Bump `version` in `app.json` (e.g. `"1.0.1"`), then:

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

`autoIncrement: true` in `eas.json` handles the build number automatically.

---

## Bundle IDs registered

| Platform | Identifier |
|----------|-----------|
| iOS | `com.couchpotato.ios` |
| Android | `com.couchpotato.ios` |

Register `com.couchpotato.ios` at [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers) before running your first build.
