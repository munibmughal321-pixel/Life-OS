# Phase 3 — backend and accounts

Implemented 2026-09-16 in the existing LifeOS development project. Production email/deep-link setup remains a release gate.

## Run it

From `D:\Munib\LifeOS app\lifeos`:

```powershell
npm run dev
```

Open http://127.0.0.1:4183/login.html (or signup.html).
After login, account.html provides private profile settings, cloud export, logout and account deletion.
The local dashboard remains available independently. Signing in does not upload, assign, erase or protect the shared device-local Phase 2 database. Use trusted devices; per-account local caches belong to Phase 4.

For a production build: `npm run build`, then `npm run preview` at port 4184.
Environment variables: copy .env.example to .env.local and supply the LifeOS project URL and **publishable** key. The local file is already configured on this workstation. Never use a secret/service-role key in a VITE variable. Netlify will need these same two public variables when deployment is authorized.

## One-time dashboard setup still required

Open the LifeOS project Authentication > URL Configuration:
- Site URL: http://127.0.0.1:4183/login.html
- Allowed redirects: http://127.0.0.1:4183/login.html and http://127.0.0.1:4183/reset-password.html
- For production-preview testing, also allow http://127.0.0.1:4184/login.html and http://127.0.0.1:4184/reset-password.html
- Add the exact HTTPS production URLs only when the hosting address is known.

Keep email confirmation enabled. Use the same browser to request and open verification/reset links: PKCE ties a link to a verifier stored in that browser. Invalid/expired links require requesting a new one.

Signup now opens verify-email.html. It keeps only the pending email/reason in tab session storage, never the password. The waiting page checks for a verified authenticated session and opens dashboard.html automatically; it also detects a session created by a confirmation callback in another tab. The existing login.html callback remains the redirect target, so its current allowlist entry is reused. If verification happens in a different browser/profile/device, use Log in there or return to the original browser; a verified email alone cannot create a session in an unrelated browser.

The page includes manual checking, explicit resend with a 60-second local cooldown, and distinct errors for email sending limits, request limits, unauthorized email recipients and unknown 429 responses. An email error never claims delivery or successful registration. The cooldown prevents rapid repeated requests; it does not guarantee the provider's quota has reset. SMTP delivery and real callback acceptance remain required.

Supabase's default mail sender restricts recipients to organization-team addresses and has low limits. Configure custom SMTP before inviting public users. No emails were sent by the automated verification; email transport was mocked for form/recovery tests. Actual email delivery and dashboard redirect settings have NOT been verified because the browser tool could not start. Native redirect URLs belong to Phase 5 when the application ID is chosen.

Official references:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/sessions/pkce-flow

## Data and security

- `profiles`: owner ID, display name, timezone, currency, revision, server timestamps. Created lazily when saving account settings; credentials remain in Supabase Auth.
- `records`: owner ID + collection + record key form a composite primary key; payload is one JSON object, with a 64 KB server limit. Individual rows avoid whole-account replacement.
- Allowed collections match existing modules except profile, which uses profiles. Lists map to one row per stable record ID; daily checklists map to date keys; singleton settings use a stable key. Legacy records without IDs need mapping during Phase 4.
- Payload envelope, ownership, collection names, length, timestamps and revisions are enforced by the database. Domain-specific payload field validation and local-to-cloud mapping must be completed in Phase 4 before automatic sync is enabled.
- Every table has separate SELECT/INSERT/UPDATE/DELETE ownership policies. Anonymous clients have no table grants. Updates cannot change owners or record identity.
- Cloud repository updates include the previous revision; stale writes are rejected. Direct API clients can update their own rows under RLS; the repository's revision check is not a database-wide mandate.
- Deletion markers are available for Phase 4; this phase does not provide a sync engine.
- Session tokens are managed by supabase-js in browser storage, never by a homemade logged-in flag. Passwords are not stored by application code.
- The delete-account Edge Function requires a valid gateway JWT, checks the user with Auth, and derives the deletion target exclusively from that user. Its privileged key exists only in the server environment.
- Account deletion cascades to cloud profiles/records. Downloaded backups and device-local data are not deleted. Cloud exports are separate from Phase 2 backup files and are not accepted by its importer.
- Export uses stable paginated ordering, not a transactional snapshot; avoid concurrent edits while exporting. `list()` currently caps results at 500; sync pagination belongs to Phase 4.

## Files and build

- backend/client.js: validated public configuration and shared Supabase client.
- backend/auth-page.js: existing login/signup/recovery form integration.
- backend/account-page.js and account.html: account controls.
- backend/repository.js: authenticated profile/record access and cloud export.
- supabase/migrations/: applied schema and platform-helper permission hardening.
- supabase/functions/delete-account/index.ts: deployed function source.
- vite.config.mjs: compiles account modules while preserving classic dashboard scripts and Phase 2 cache generation.

No archive or unrelated frontend work was overwritten. No production website was published.

## Verification

- Production build passed.
- Live check script verified 29 behaviors: two real temporary users, valid login, cross-account read/write/delete denial, anonymous denial, spoofed ownership, revision conflicts, export, real browser login/profile persistence/logout, narrow-screen layout and authenticated account deletion.
- Temporary accounts were deleted via the function; no permanent credentials were introduced.
- Supabase security advisor returned no findings after permission hardening.
- Existing Phase 2 tests passed after account bundling changed.
- tests/phase3-auth.test.mjs tests form validation, failed login, offline feedback, verification messaging, PKCE recovery and invalid links with mocked email transport.
- scripts/verify-backend.mjs needs an ignored .phase3-test-accounts.json containing two dedicated disposable users. It deletes these accounts on success; never run it with real-user credentials. The verification fixture is removed after the run.

## Next handoff

Verification flow follow-up (2026-09-24): production build and all 15 tests across six files passed. The browser test simulates confirmation emails and checks both the callback tab and waiting tab reach the dashboard, plus email-limit/resend feedback and password recovery. Actual inbox delivery remains unverified.

First verify email redirect settings and real mail delivery using your own eligible inbox. Then Phase 4 can explicitly associate local history with an account, add isolated caches and synchronize records with recoverable conflicts. Do not claim public registration or native auth ready until SMTP, live email callbacks and native testing pass.

## In-app account controls (2026-09-16)

Dashboard and Me now expose Your account, Log out and Switch account. They route through the existing Phase 3 account page. Log out ends this browser's Supabase session and returns to login; Switch account signs out first and opens login with a switching explanation. No new authentication system was added.

The request uses signOut({scope:'local'}), preserving sessions on other devices. Device-local dashboard records/backups are not erased, reassigned, uploaded or hidden. They remain a shared local workspace; per-account local caches remain Phase 4 work. A failed routed action displays an explicit Retry sign out button. Login displays the reason for returning.

Verification uses mocked Supabase authentication in isolated browser contexts, including login, switch, local-only scope, preserved browser data and sign-out error/retry. It does not sign out the user's real browser session. The production build and regression suite are the verification commands.


## Signup codes and dashboard identity (2026-09-27)

Signup still creates a password account with display_name metadata. The verification
page now submits the emailed numeric token using verifyOtp with type email; a
verified session opens dashboard.html. Existing confirmation-link callbacks and
password recovery remain supported. Resend uses type signup, retains a cooldown,
and never claims delivery when the email provider rejects a request.

Hosted setup required: in lifeos-dev, open Authentication > Email Templates >
Confirm signup (or Authentication > Emails > Confirm signup). Replace the body
with lifeos/supabase/templates/confirmation.html and save. Its {{ .Token }} value
is generated by Supabase. Keep email confirmation enabled. This repository file
does not update the hosted template automatically. The browser-control tool
could not start during this implementation, so hosted template application and
real inbox delivery are not verified. SMTP/sending limits still apply.

Successful login and account-profile saves now open the dashboard. The dashboard
uses the account profile name, falling back to signup metadata and an account-ID
scoped offline name cache. Device-only tracker names and optional record sync
remain separate. Failed profile saves retain the form and show the error.
