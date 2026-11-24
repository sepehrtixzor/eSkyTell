# eSkyTell — Web / iPhone PWA

A web (PWA) port of the Android app in `../app` (Kotlin + Jetpack Compose), built with Vite + Preact + TypeScript and the
Firebase JS SDK v10. It uses the **same Firebase project** (`gen-lang-client-0105568417`), the **same named Firestore
database** (`ai-studio-android-eskytell-cf7f4dde-bd08-4864-9f68-5fd5fc18d8b7`) and the same collections/fields
(`users`, `app_config/global`, `announcements`, `payment_config/main`, `payment_requests`), so the Android and web apps
share accounts, subscriptions, payments and the admin studio. `firestore.rules` needs no change.

## Develop / build
```bash
npm install
npm run dev            # http://localhost:5173/eSkyTell/
npm run build          # output: dist/  (base path /eSkyTell/ for https://sepehrtixzor.github.io/eSkyTell/)
BASE_PATH=/ npm run build   # for a custom domain / root hosting
```
Routing is hash based (`#/phone`, `#/messages`, `#/bridge`, `#/more`) so GitHub Pages needs no rewrites.

## Firebase setup (one time, in Firebase Console)
1. Project settings → General → **Add app → Web**. Copy `appId` (and `messagingSenderId`) into `src/firebase-config.ts`.
   Auth and Firestore already work without `appId`.
2. Authentication → Settings → **Authorized domains** → add `sepehrtixzor.github.io` (and any custom domain).
3. Google Cloud Console → APIs & Services → Credentials → the browser API key `AIzaSyBlHg_…`: if it is restricted to
   Android apps, either add an HTTP-referrer entry for `https://sepehrtixzor.github.io/*` or use a separate browser key
   in `src/firebase-config.ts`.

## Install on iPhone
Open the site in Safari → Share → **Add to Home Screen**.

## What differs from Android (platform limits)
* Bluetooth bridge (RFCOMM / BLE GATT / OPP): iOS Safari has no Web Bluetooth, so scanning/connecting is shown as
  unsupported; exports (HTML, vCard, JSON, CSV, TXT) are shared through the iOS share sheet / download instead.
* Calls and SMS open the iPhone dialer (`tel:`) / Messages app (`sms:`); the in-app call screen is the same HUD.
* Phone-book import uses the Contact Picker API where available (not in iOS Safari); vCard import works everywhere.
* Local SMS/call/contact/history data is stored in this browser (localStorage), like Room on Android.
* Admin payment notifications: browser notifications (iOS 16.4+ only for installed PWAs) instead of Android
  notifications with approve/reject actions.
