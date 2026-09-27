# Try LifeOS and send feedback

LifeOS is a personal organizer for activities, sleep, goals, learning, finances, optional Deen tracking, and wellbeing. This is an early testing preview, not a finished production release.

## Download status

The [Android testing preview](https://github.com/munibmughal321-pixel/Life-OS/releases/tag/v0.1.0-preview.20260927) is public. [Download the APK](https://github.com/munibmughal321-pixel/Life-OS/releases/download/v0.1.0-preview.20260927/LifeOS-preview-2026-09-27.apk). The release includes a SHA-256 checksum.

The release is listed at https://github.com/munibmughal321-pixel/Life-OS/releases. There is no verified hosted web link yet. iPhone installation is not available; iOS source exists but has not been compiled and accepted on a device.

## Android installation

1. Download the LifeOS preview APK from this repository's release assets . Android 7.0 or later is the build's minimum target; that does not mean every supported phone has been tested.
2. Open the APK. Android may ask you to allow installation from the browser/file manager you used. Allow that source only if you trust this release, then turn the permission off after installation.
3. Open LifeOS and start with the device-only dashboard. Use sample records while testing.
4. Export a backup before replacing an older installation. An incompatible signing certificate can prevent an update; uninstalling removes local data, so do not uninstall without a backup you have verified.

This APK is debug-signed for testing, not a Play Store release. Phone behavior, native email callbacks, and background reminders still need real-device acceptance.

## Suggested 10-minute test

- Open all six modules and check that text/buttons fit your screen.
- Start and stop an activity, edit it, close LifeOS, and reopen it.
- Add a goal, a sample expense, and a journal entry. Edit and delete sample records.
- Turn on airplane mode, reopen the dashboard, and check whether your local records are still available.
- Export a backup. Treat the exported file as private: it contains your records and is not encrypted.
- If testing accounts, try signup, verification, login, and recovery. Email template/SMTP settings are still being finalized; report failures rather than repeatedly requesting codes. Never share a password or verification code.
- Cloud sync is opt-in and uses a separate account workspace. Signing in does not upload device-only history. Back up test records before experimenting across devices.
- Enable location reminders only if you want to test them. Background delivery depends on phone permissions and battery settings; confirming a prompt should be required before an activity is created.

## Send feedback

Use https://github.com/munibmughal321-pixel/Life-OS/issues/new/choose (GitHub sign-in required). If you do not use GitHub, send these details directly to the person who shared LifeOS:

- Phone model and Android version, or browser/version.
- Preview version/date.
- What you tried, with steps to reproduce.
- What you expected and what actually happened.
- Whether you were offline, device-only, or signed into an account.
- A screenshot with names, email addresses, balances, journal text, and codes hidden.

Do not attach full backups, tokens, passwords, verification codes, or private health/financial records. For a possible security problem, contact the maintainer privately rather than opening a public issue containing exploit details or private data.

## What was checked

On 2026-09-27: deployment artifact checks passed (65 files, nine HTML pages); all 24 automated tests across ten files passed on a serial run; Android compilation and APK signature verification passed; all 65 web files in the APK matched the tested build byte-for-byte. Browser cloud/email transport and native bridges are mocked in the automated suites. These checks do not establish real email delivery, live two-phone sync, or physical-device background behavior.

First run caveat: a test run timed out waiting for offline caching while an Android build was concurrently replacing dist. The full suite passed when rerun after the build finished. Run builds and artifact-dependent suites sequentially.
