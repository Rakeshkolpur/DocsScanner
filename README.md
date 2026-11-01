# FileQuik — Scan & PDF Studio

Scan, organize and manage your documents without unnecessary complications. No login, no cloud, no tracking — everything runs on-device.

## Features

- **Scan Document** — camera capture with automatic edge detection, manual corner adjustment, grayscale/B&W/enhanced modes, and a "Record & auto-scan" mode that captures each page automatically as you flip through a stack
- **Images to PDF**, **Split**, **Merge**, **Watermark** (text/logo), **Rotate**, **Reorder**, **Extract**

Everything — PDF generation, perspective correction, image enhancement — runs client-side in the browser (or in the Android app's WebView). Nothing is uploaded anywhere.

## Development

```bash
npm install
npm run dev
```

## Android app

This repo includes a [Capacitor](https://capacitorjs.com/) wrapper under `android/` that packages the web app as a native Android app.

**Get the APK:** every push to `main` triggers [.github/workflows/build-apk.yml](.github/workflows/build-apk.yml), which builds a fresh debug APK and publishes it to the repo's **[latest release](../../releases/tag/latest)**. Download `app-debug.apk` from there and install it on your phone (enable "install from unknown sources" the first time). Re-download and reinstall after future updates — same app ID, so it upgrades in place and keeps your settings.

Building locally:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug   # or gradlew.bat on Windows
```

The APK is output to `android/app/build/outputs/apk/debug/app-debug.apk`.
