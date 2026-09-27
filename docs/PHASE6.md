# Phase 6 — release preparation and deployment

Updated: 2026-09-27. Status: local web release preparation in progress; no hosted site or public release yet.

## What is implemented

The existing Vite build stays intact, including classic dashboard script ordering and its content-versioned service worker. Root netlify.toml uses lifeos as the base, npm run build:deploy as the command, and dist as the publish directory. It disables post-processing to preserve .html callbacks and offline URLs; no SPA catch-all rewrite is added.

build:deploy checks the public configuration before bundling, then inspects the finished artifact. The checks reject unexpected VITE_ variables, missing/placeholder/privileged keys, the wrong Supabase project, private/source-only files, recognized credential patterns, missing pages, broken HTML asset links and a mismatched offline file inventory. These checks are targeted safeguards, not a complete secret/security audit.

The default project is lifeos-dev (nfuakxpnixexbuzgiyeg). Changing to a separately approved production project requires setting LIFEOS_SUPABASE_PROJECT_REF as well as its corresponding URL and publishable key. This setting does not provision projects, copy data, apply migrations or validate a key against the server.

Headers prevent framing, disable MIME sniffing and omit referrers, including callback query strings. Files revalidate; sw.js uses no-store. All pages carry noindex/nofollow while this is a preview-stage setup. Noindex is NOT access control: an unprotected preview URL is still publicly reachable. A restrictive script CSP is deferred because the current dashboard uses inline event handlers; do not add a policy that silently breaks those controls.

The Windows GitHub workflow installs from the lockfile, builds with synthetic values, checks the artifact, runs the serial test suites (including entry design and release checks), and audits production dependencies. Its synthetic build is never deployed. The workflow is preserved locally and on the local codex/with-release-workflow branch. GitHub rejected its upload because the current OAuth login lacks workflow scope. It is excluded from the main source checkpoint until that permission is granted. No hosted Actions run has been verified.

## Local commands

Run in D:\Munib\LifeOS app\lifeos:

~~~powershell
npm ci
npm run build:deploy
npm test
npm audit --omit=dev --audit-level=high
npm run preview
~~~

In another terminal, from the same folder:

~~~powershell
npm run smoke:deploy -- http://127.0.0.1:4184 --local
~~~

Local preview is not online publishing. It uses port 4184 to stay separate from development's 4183 origin and storage. The static smoke check does not log in, send email, or write data. It checks public routes and missing/private paths; local mode deliberately skips host-specific header checks.

## Netlify setup — account exists, site not created yet

1. Review the full uncommitted earlier-phase implementation and Phase 6 files before committing a release candidate. Do not push only netlify.toml against the obsolete GitHub app; its build dependencies and current sources must accompany it. Keep misc, .env files, exported user data, signing keys, SDK paths, generated native assets and dist excluded.
2. Create a preview/staging Netlify project from the private munibmughal321-pixel/Life-OS repository and the reviewed candidate branch. Keep the existing coordinated web/Android/iPhone public-launch target; this is a test deployment.
3. Confirm base lifeos, command npm run build:deploy, publish dist relative to that base (resolved lifeos/dist). Node is pinned to the locally verified 22.18.0 by netlify.toml.
4. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the Netlify environment UI with build scope and the intended deploy context. Retrieve the publishable key from the LifeOS project. Never add service-role/secret keys, database passwords or Supabase access tokens to VITE_ variables.
5. Keep previews on lifeos-dev and use test accounts. Configure a production project separately only after its migration, ownership and recovery gates pass. Do not use DABS or portfolio projects.
6. Record the assigned HTTPS URL. Add the exact login.html and reset-password.html callback URLs on that origin to the LifeOS Supabase Auth redirect allowlist. Verify the intended Site URL. Use exact stable staging/production origins rather than broad wildcard grants. Retain approved native callbacks documented in PHASE5.md.
7. Deploy the reviewed build. From lifeos/, run npm run smoke:deploy -- https://YOUR-SITE.netlify.app. Fix any redirect, content-type, header or 404 failures before testing accounts. If Netlify pretty URLs are enabled in a competing setting, retain explicit .html routes instead.
8. Verify actual signup, confirmation, password recovery and account deletion with disposable test accounts. PKCE email links must return to the initiating browser/app. The mocked tests do not prove inbox delivery, sender configuration, hosted allowlists or provider quotas.
9. Record the deploy ID, Git commit, build commands, exact host, backend project/migrations, test date and outstanding gates here before calling the preview verified.

Account creation alone does not provide this assistant with a Netlify session or authorize a production launch. No site was created in this preparation.

## Public-release gates

| Gate | Current evidence / required action |
| --- | --- |
| Local build and release checks | Run commands above and record results below. |
| Hosted Netlify deployment | No site yet; hosted headers/routes and callbacks unverified. |
| Cloud schema | Read-only live check on 2026-09-27 confirms four local migration versions match lifeos-dev. |
| Password protection | Live advisor still reports leaked-password protection disabled. Review available configuration/plan support and resolve before public release. |
| Email | Configure a suitable SMTP sender and verify inbox delivery, recovery and redirect allowlists. |
| Data reliability | Complete a real two-profile/device sync, conflict, delete/retry and backup/restore drill against test data. |
| Privacy/support | Finalize operator/support contact, retention/deletion explanations, unencrypted local backups and optional device-local location disclosures. No placeholder legal text is published. |
| Android | Debug APK is a Phase 5 test artifact, not a Play release. Real-device acceptance, release signing/AAB and store artwork remain. |
| iPhone | Mac/Xcode signing, compiled build, physical iPhone acceptance and store submission remain. |
| Operations | Record a restore drill, release owner, privacy-conscious error handling and host/backend limits; no raw journals, finance, auth tokens or coordinates in diagnostics. |
| Coordinated launch | Still gated on web + Android + iPhone acceptance, funding and store review. |

## Rollback and recovery

Before publishing, retain the known-good Netlify deploy ID, commit and backend migration versions. Keep database changes backward compatible across the current and previous app release.

If the new web build fails, stop automatic publication of the failing branch and republish the known-good Netlify artifact. Re-run the static smoke check and account flows. Redeploying a website does not roll back Supabase migrations, IndexedDB/SQLite schemas or native binaries; assess compatibility separately. Do not erase local data or reverse database migrations as a generic rollback.

The offline service worker deliberately waits while existing pages are open to preserve drafts. After users save/export pending work and close all LifeOS tabs, reopen the app and verify the restored build. An already open offline client can continue running its cached version until an update activates; Netlify rollback cannot instantly replace it.

For data loss, pause affected writes, preserve the failed database/local state, restore to an isolated recovery target first, verify record ownership and counts, then decide on restoration. Local JSON backups contain private unencrypted records. Never attach them to GitHub issues or upload them to the web publish directory.

## References

- [Netlify file-based configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [Netlify custom headers](https://docs.netlify.com/manage/routing/headers/)
- [Vite public environment variables](https://vite.dev/guide/env-and-mode)
- [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Local validation - 2026-09-27

Before the requested GitHub source update, npm run build:deploy passed (65 files and nine HTML pages), npm test passed 24 tests across ten sequential files, and npm audit --omit=dev --audit-level=high reported zero vulnerabilities. No hosted deployment, real email round trip, store publication or physical-device acceptance was performed by these checks.
## 2026-09-27 testing-preview preparation

See [TESTING.md](TESTING.md) for user-facing progress and feedback instructions. Deployment build, the final serial 24-test suite, Android rebuild, signature verification, and 65 packaged-asset comparisons passed. A public Android preview is prepared, but repository visibility is blocked by an old committed password-verification file pending approved history cleanup. The Netlify browser session could not be accessed; no hosted web link is verified. This testing-preview request does not mark production release gates complete.
