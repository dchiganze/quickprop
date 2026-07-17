# QuickProp Agent — App Store Submission Guide

## What's already done ✅
- 1024×1024 app icon (`assets/images/icon.png`)
- Splash screen (`assets/images/splash.png`)
- Android adaptive icon (`assets/images/adaptive-icon.png`)
- Bundle IDs set: `com.quickprop.agent` (iOS & Android)
- iOS privacy usage descriptions (camera, photos, location, contacts, microphone)
- Android permissions
- Production build profile with `.aab` (Android App Bundle) output
- `eas.json` configured for both stores

---

## What you need to do before running the build

### 1. Fill in `eas.json` submit credentials

Open `eas.json` and replace the placeholders:

| Placeholder | Where to find it |
|---|---|
| `YOUR_APPLE_ID@email.com` | Your Apple Developer account email |
| `YOUR_APP_STORE_CONNECT_APP_ID` | App Store Connect → My Apps → App Information → Apple ID |
| `YOUR_APPLE_TEAM_ID` | developer.apple.com → Account → Membership |
| `google-play-service-account.json` | Google Play Console → Setup → API access → Create service account |

### 2. Create the app records in both stores

**App Store Connect** (appleid.apple.com → App Store Connect)
- New App → iOS → Bundle ID: `com.quickprop.agent`
- App Name: QuickProp Agent
- Category: Business or Productivity
- Primary language: English

**Google Play Console** (play.google.com/console)
- Create app → App name: QuickProp Agent
- Free or paid → select
- App or Game → App
- Category: Business

### 3. Prepare store listing assets (required before public release)

Both stores require screenshots before going live. You can submit to **internal testing** first without them.

| Asset | iOS | Android |
|---|---|---|
| Screenshots | 6.7" iPhone (required) + iPad | Phone + 7" tablet |
| Short description | 30 chars | 80 chars |
| Full description | 4000 chars | 4000 chars |
| Privacy policy URL | Required | Required |

---

## Build & Submit commands

Run these from the `artifacts/mobile` directory (or the repo root with `--filter`):

```bash
# 1. Install EAS CLI (if not already)
npm install -g eas-cli

# 2. Log in with your Expo account
eas login

# 3. Build for both stores (takes ~15-30 min on EAS servers)
eas build --platform all --profile production

# 4. Submit to both stores
eas submit --platform all --profile production

# --- OR submit to internal testing track first ---
eas submit --platform android --profile production  # submits to 'internal' track
eas submit --platform ios --profile production       # goes to TestFlight first
```

### Tip — submit to internal testing first
- **iOS**: builds land in TestFlight. You control who gets access before hitting "Submit for Review".
- **Android**: set `"track": "internal"` in `eas.json` (already done). Promote to production from the Play Console when ready.

---

## App Store review timeline
- **Google Play internal → production**: ~1–3 days for first submission
- **App Store (Apple)**: typically 1–2 days; first submission may take longer
