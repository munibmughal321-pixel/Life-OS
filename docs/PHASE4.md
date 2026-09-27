# Phase 4 — account workspaces and cloud synchronization

Implemented in the active browser application, 2026-09-22. Native apps and public deployment remain later phases.

## How to use it

Run `npm run dev` inside `D:\Munib\LifeOS app\lifeos`, then open http://127.0.0.1:4183/dashboard.html.
For offline reopening use `npm run build`, `npm run preview`, and http://127.0.0.1:4184/dashboard.html.
Wait for **Ready for offline use** before disconnecting. Origins and browser profiles retain separate local databases.

1. Signed out: the dashboard opens the original device-only workspace.
2. Sign in through the existing account pages, then open the dashboard: it opens that account's separate local workspace.
3. Press **Enable sync for this account** and confirm the upload scope. Signing in alone never uploads tracker records.
4. New local saves sync after a short delay. Launch, reconnect, focus/resume, the periodic visible-page check, and **Sync now** also trigger syncing.
5. After downloaded changes are stored, use **Reload to view cloud changes**. Finish/copy unsaved drafts first. Automatic redraw is avoided to protect form input.
6. To move old history: sign out, download a local backup, sign in, then preview/import that backup explicitly. Import replaces that account's local tracker snapshot; with syncing enabled its changes subsequently upload. Keep the source backup.
7. **Pause sync** stops future sync attempts; operations already in flight may finish. Other tabs recheck the saved preference.
8. Logout retains pending local records for that account. Sign back in to resume. It does not discard the queue. Sign-out/account changes in another tab hide and lock the old dashboard until reload.

Use test records for acceptance testing. Existing Phase 3 email delivery/redirect and public SMTP gates still apply.

## Storage and interfaces

- `js/storage.js` selects `lifeos-local` for device-only use or `lifeos-account-<user ID>` for an account. Both keep Phase 2 collection/recovery stores and atomic transactions.
- `js/sync-storage.js` exposes read/commit operations to modules, validates stored sync history, and rejects stale local revisions or changed metadata in one IndexedDB transaction.
- `backend/sync-engine.js` maps all 19 collections to individual cloud rows and performs three-way reconciliation: current local value, last acknowledged value, and current cloud value.
- `backend/sync-remote.js` binds all requests to the original authenticated owner and uses keyset pagination across collections. It reads beyond the old 500-row limit. Writes compare cloud revisions.
- `backend/sync-page.js` owns opt-in controls, status, conflict review, local account selection and automatic retry triggers.
- Dashboard classic scripts keep their dependency order. Vite bundles the new dashboard module while preserving classic files and offline asset caching.
- The applied `phase4_tracker_profile` migration permits `profile` in records. This is the complete tracker profile (learning preferences, etc.); `public.profiles` still stores the separate cloud account name/timezone/currency. These are intentionally not silently merged.

Lists use stable IDs, or dates for existing daily records. Checklists use date keys. Settings use `settings`. Duplicate daily identities or unsupported/oversized records block syncing with an error instead of being guessed or discarded.

## Durability and conflicts

The durable queue is derived from committed local collections compared with the acknowledged baseline in the recovery store's `sync-state` entry. It is not a second independent list of pending operations. A local save cannot be lost between a collection write and creating a queue entry.

Local and cloud payloads are compared structurally. Equal remote results acknowledge interrupted uploads without creating duplicates. Deletions produce retained cloud tombstones, and authenticated clients no longer have physical `DELETE` permission on tracker rows. Missing rows, tombstones and active rows are distinct reconciliation states, so an old cache cannot silently revive a deletion it never acknowledged. Changes to different records merge; competing edits or delete/edit races keep both copies for review.

Conflicts are stored locally. Expand a conflict, review both payloads, download both copies if needed, select **Keep local** or **Keep cloud**, then **Sync now**. A choice is tied to the exact reviewed payloads and remote revision; a later remote edit requires review again. No automatic last-device-wins policy is used.

The local acknowledgement checks the original collection envelopes and metadata atomically. If another tab or a form changes data during a request, the acknowledgement fails and preserves the newer local data. A retry may require resolving a conflict after a partially completed upload.

Full merged collections are validated before sending writes, including the rule that only one activity may be running. A cross-record incompatibility (for example, different active timers on two devices) pauses sync; export backups and finish/correct the competing entries before retrying.

## Privacy and limitations

- A remembered account ID selects a local cache when offline, or when the browser reports online but the Auth session check is temporarily unavailable. It is not cloud authorization. Cloud reads/writes independently verify the authenticated owner before and after remote responses and again before local acknowledgement.
- Logout clears the remembered account selection. Local caches and backups are not encrypted or remotely wiped. Use trusted browser profiles; device access/developer tools can access local storage.
- Welcome/onboarding preferences remain device-local, outside tracker syncing. Account settings remain on the separate account page.
- Cloud SQL enforces ownership, identity, revisions and payload envelope/size; dashboard domain validation runs before mapping and applying downloaded data. Arbitrary direct API clients can still store malformed *own* payloads, which the app rejects. Database-wide domain-field validation is not claimed.
- Sync uses full paginated pulls, not a change feed or a transactional snapshot. Concurrent changes not seen in one pull appear in the next; stale writes are rejected.
- Cross-record updates are not one atomic cloud transaction. Interrupted batches remain recoverable through the baseline and subsequent reconciliation.
- Web Locks serialize sync attempts in the same browser origin. Unsupported browsers retain local saving but cannot sync through this implementation.
- Clearing browser data, losing the device, or deleting the account can make retained account-local data inaccessible through normal sign-in. Account deletion now requires acknowledging this and points to the dashboard backup first.
- No private user records were uploaded during development tests. No Git commit, push, website deployment or email delivery configuration was performed in this phase.
- Supabase's security advisor reported disabled leaked-password protection during the Phase 4 check. Review before public release: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Verification

Build: `npm run build`.
Regression: `npm test` (the runner executes each test file serially so Edge suites do not compete).
Focused tests: `node --test tests/phase4.test.mjs` and `node --test tests/phase4-browser.test.mjs`.

Eight focused mapping/protocol tests pass: all 19 collections, rejected invalid identities, tombstone-resurrection protection, both conflict choices, lost and partial acknowledgements, concurrent local changes, invalid merged timers, 1,002-row pagination, and account changes during final read/write responses.
The two-context browser test uses mocked Supabase transport and real IndexedDB/service workers; it exercises opt-in, guest separation, offline reopening, online-but-expired session fallback, syncing, conflict resolution, deletions, separate accounts and local compare-and-swap.
Live SQL verification in lifeos-dev passed for the new collection, revisions, stale-write rejection, tombstones and cross-account read/update/delete/owner-spoof rejection. The 2026-09-22 migration additionally removed authenticated hard-delete permission and its RLS policy; a live privilege query returned false for both. Temporary fixture users and rows were rolled back. This is not a live two-device network or real-phone acceptance test.

On 2026-09-22, `npm run build` passed and `npm test` passed all 14 tests across six files with zero failures. Real email callbacks, a real Supabase two-device browser trial, real-phone acceptance and production deployment remain release gates.

## Practice

Follow-up verification on 2026-09-23: the production build and focused Phase 4 browser suite passed after adding stale cross-tab preference handling and serializing Enable/Pause with automatic sync. The browser suite also verifies that account deletion is blocked until the backup/access-loss warning is acknowledged. The full 14-test result above is from 2026-09-22; the focused suite was rerun for these final changes.

Create a sample note on one browser profile and sync it. Sign in to the same account on another profile, enable syncing, and reload after download.
Pause sync on both, edit the same note differently, then resume each. Review both copies and deliberately select the desired one.
Explain why the app needs a baseline and a revision instead of simply trusting whichever device has the newest clock.
