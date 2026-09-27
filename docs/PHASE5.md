# Phase 5 — native apps

Updated: 2026-09-27; build completed 2026-09-25 and artifact rechecked 2026-09-27.

## Status

Android and iOS source projects and JavaScript integration are implemented. The Android debug APK compiles and its signature verifies. Android lint passes with zero errors and 15 nonblocking dependency/resource/artwork warnings. The Vite build and 20 tests across eight files passed during implementation; all five native adapter tests passed again after Android setup. Those adapter tests use real Node SQLite and a simulated Capacitor bridge in Edge. iOS compilation and physical Android/iPhone acceptance remain required.

Windows tooling (2026-09-25): Android Studio Quail 4 Patch 1, Microsoft OpenJDK 21.0.12.1, Android SDK Platform 36, Build Tools 35.0.0/36.0.0, platform tools 37.0.1 and Gradle 8.14.3 are installed. All `native:doctor` checks passed. Studio/JDK are user-local installations; the Start Menu shortcut is **Android Studio (LifeOS)**. The debug APK is ready for the user's deferred phone test. iOS requires macOS, Xcode 26+, signing and an iPhone. No signed release, store upload, cloud migration, Git commit/push or deployment was completed.

Earlier uncommitted phase changes were preserved. Touched sources were checkpointed under local-only `misc/phase5-before-2026-09-24`.

## Architecture and file ownership

- `capacitor.config.json`: app ID/callback scheme `com.munib.lifeos`, bundled assets from `dist/`. Keep the identifier stable after installing; changing it creates a separate app.
- `native/storage.js`: native-only implementations of existing storage/backup/sync boundaries. Browser IndexedDB and classic dashboard load ordering remain intact.
- `native/workspace.js`: versioned document and revision-based compare-and-swap protocol.
- `android/app/src/main/java/com/munib/lifeos/`: Java SQLite, Keystore, share sheet, geofence and reboot integration.
- `ios/App/App/LifeOSDevicePlugin.swift`: Swift SQLite, Keychain, share sheet and region monitoring. Registered through the custom view controller and Xcode project.
- `native/runtime.js`: Android Back, keyboard/safe-area UI, app resume and allowlisted callbacks. Native assets skip browser service-worker registration.
- `native/places.js`: Saved places beside Backup & recovery. Web users have explicit foreground checks; native users separately enable background reminders.

## Storage and privacy

SQLite stores one versioned row per workspace, with logical collections and recovery stores. It retains the 19 version-1 collection envelopes, backup checkpoint and Phase 4 sync metadata. A single transaction checks the expected row revision and atomically writes the replacement; stale changes fail. Android chunks large reads to avoid CursorWindow limits.

Native documents are limited to 25 MB with visible failures; normal backup import retains its 10 MB limit. Tracker data is not application-level encrypted. Android uses app-private storage, disables legacy backup, and explicitly excludes app storage from Android 12+ cloud backup and device transfer. iOS applies file protection and excludes the SQLite directory from backup. Uninstall/data clearing can erase records; use external backups or account sync.

Native auth sessions and PKCE verifiers use Android Keystore-backed AES-GCM or iOS Keychain, with no localStorage fallback. A fresh iOS install clears surviving app Keychain entries to avoid inheriting a prior identity.

Native databases are separate from the browser. Explicitly export/preview/import a browser backup or enable account sync in the installed app. No browser history is silently uploaded. Logout retains account-isolated native records/pending work under the Phase 4 policy.

## Arrival reminders

Save your current location, a name, activity and radius of 100–1000 metres; maximum 10 places. Places stay on the device, are shared across its workspaces, are not synced, and are excluded from tracker backups. No movement history is recorded. Disable reminders or remove places from the same dialog.

Android uses Google Play services geofencing with a two-minute dwell and exit detection. Monitoring is re-registered after reboot/update when permissions allow it. On Android 11+, choose Location > Allow all the time in system settings, then return and enable reminders again. Notification permission is separate. Devices without suitable Google Play services may not support this integration.

iOS uses Core Location region entry/exit and local notifications. Always location and notification permissions are required. The app delegate initializes monitoring for background location wakeups. Permission denial/revocation leaves manual tracking available.

Notifications use generic lock-screen text. A tap opens the existing activity setup form; its confirmation is still required to create a record. Duplicate prompts are suppressed until an exit. Delivery is best effort and requires real checks for locking, termination, force-stop/quit, reboot and battery restrictions.

## Windows / Android setup

The tools are already installed on this computer. The active Android SDK is **D:\Android\Sdk**. Select this exact folder in Android Studio's **Select Android SDK** dialog. LifeOS local.properties and ANDROID_HOME both point here. For another Windows computer:

1. Install Android Studio, SDK Platform 36, and platform/build tools through SDK Manager. The current Android Gradle plugin selects Build Tools 35.0.0.
2. Select JDK 21 for Gradle. Set JAVA_HOME to that JDK and ANDROID_HOME to the SDK directory. Do not use the detected JDK 26 with this wrapper.
3. Run:

```powershell
cd "D:\Munib\LifeOS app\lifeos"
npm ci
npm run native:doctor
npm run native:sync
npm run android:open
```

4. Enable USB debugging, connect the Android phone, approve its debugging prompt, select it in Android Studio, and run.

`npm run android:build` rebuilds web assets, synchronizes native projects and builds the LifeOS debug APK. Verified output: `android/app/build/outputs/apk/debug/app-debug.apk` (5,411,826 bytes, about 5.16 MiB). Package: `com.munib.lifeos`; minimum SDK 24, target SDK 36. Copy this file to the Android phone and open it to install when ready; USB debugging is not needed for manual APK installation.

This APK is signed with the local development key for testing. Store signing, release branding and publication remain release work. Browser records are separate; transfer them explicitly through backup import or account sync.

On this computer, the ignored `.env.android.local` selects the user-local JDK through `LIFEOS_JAVA_HOME`, the SDK through `ANDROID_HOME`, and Android Studio through `CAPACITOR_ANDROID_STUDIO_PATH`. The build launcher sets `JAVA_HOME` only for the Gradle process. Android Studio uses the ignored `.gradle/config.properties` and `.idea/gradle.xml` to select the same JDK. Other projects can keep using the existing Java 26 installation. The Gradle wrapper uses the smaller binary distribution with its official SHA-256 checksum and a longer download timeout.

Run native:sync after changing frontend code. Never edit the generated Android assets/public or iOS public directories directly.

## Mac / iPhone setup

Install Node 22+ and Xcode 26+, run npm ci, npm run native:sync, and npm run ios:open. Select a signing team and real iPhone in Xcode. The project uses Swift Package Manager. Simulator testing cannot prove background physical-device behavior. Store/launcher graphics remain generated placeholders until release branding.

## Native auth configuration

Add these exact URLs to the separate LifeOS Supabase project's Auth redirect allowlist before real email testing:

- `com.munib.lifeos://auth/login.html`
- `com.munib.lifeos://auth/reset-password.html`

This task changed callback selection in client code only; the hosted allowlist and email delivery were not changed. Initiate verification/reset and open the email link on the same installed app/device so the PKCE verifier is available. Unrecognized callback hosts/routes/token fragments are rejected. Consumed launch links are represented by a digest to prevent repeated navigation without storing the code.

## Device acceptance gates

- Fresh offline launch from bundled assets; no native service-worker registration.
- All collection create/edit/delete, terminate/reopen, running timers, app update without uninstall.
- Backup import/export/recovery, canceled sharing and low-space/failed writes.
- Account switching, logout/relogin, expired session offline, token persistence and real verification/reset callbacks.
- Two-device sync conflicts, deletion markers and interrupted-upload retries.
- Android Back, dialogs, pending saves, keyboard, rotation, touch targets and safe areas.
- Permission grant/deny/revoke, background/locked/terminated arrival, repeated visits, deleted/disabled places, reboot/update and battery restrictions.
- iOS compilation and real-phone acceptance on both platforms. Android compilation is verified.

## Verification

Run npm run build, npm run test:native, npm test, npm run native:sync and npm run native:doctor from lifeos/.

The CLI's xcode -> uuid dependency is overridden to 11.1.1 to remove its advisory while preserving the required CommonJS v4() API. The tests parse the Xcode project and exercise UUID generation. npm audit reported zero vulnerabilities after installation.

References: [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup), [Android geofencing](https://developer.android.com/develop/sensors-and-location/location/geofencing), [Capacitor App lifecycle](https://capacitorjs.com/docs/apis/app).

Final source revalidation: after the cloud/conflict export changes, the production build and seven affected tests passed; Android/iOS asset synchronization succeeded and the production dependency audit reported zero vulnerabilities. During tooling setup, the five native adapter tests passed again and `native:doctor` passed after the SDK/JDK installation.

### Android build evidence (2026-09-25, artifact rechecked 2026-09-27)

- First native build succeeded; the subsequent app-only incremental build took 11 seconds.
- `:app:assembleDebug :app:lintDebug` passed after fixing permission-revocation handling, protected-broadcast action validation, explicit backup/transfer exclusions and local SDK property escaping. No lint errors were suppressed. Fifteen nonblocking dependency/resource/artwork warnings remain in `android/app/build/reports/lint-results-debug.html`.
- `apksigner verify --verbose` passed using APK signature scheme v2. Package inspection found no archives, environment files, tests, Git metadata or dependency directories.
- Five native adapter/browser tests passed again. These do not replace phone acceptance.
- Final APK SHA-256: `ED937ACED2AFB92A5DCF73297EC820FB2918A79B197239783AAD74DB4708F9D9`. This identifies the recorded build; future builds can have different hashes.
- The user chose to test on a phone later. Phone installation, physical geofence delivery and native email callbacks remain unverified.

References: [Android JDK selection](https://developer.android.com/build/jdks), [Android backup and transfer rules](https://developer.android.com/identity/data/autobackup), [Microsoft OpenJDK downloads](https://learn.microsoft.com/en-us/java/openjdk/download).
