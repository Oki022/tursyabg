# ТърсяБГ mobile app (Capacitor)

The app loads https://tursya.bg in a native shell. It has its own packages, so
the website build (Vercel, Azure CI) is not affected.

First time (Windows, Android Studio installed):

```powershell
cd mobile
npm install
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio: connect the phone (USB debugging on) and press Run.

After changing `capacitor.config.ts` or adding a plugin: `npx cap sync android`.
Site changes need no app rebuild.
