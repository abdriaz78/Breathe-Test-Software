# QuinTron Breath Test — Software Audit

_Date: 8 Nov 2026 · Branch: `feature/pwa-patient-portal` · Scope: whole codebase (auth, RBAC, hospital isolation, data layer, API, UI, PWA, dependencies, ops readiness)._

## 1. Fixed on this branch

| # | Area | Finding | Fix |
|---|------|---------|-----|
| F1 | Isolation | `createTest` trusted the submitted `technicianId`, `departmentId` and `testTypeId`. A crafted request could link a test to **another hospital's** staff or department. | Server now requires each one to be active and belong to the patient's hospital (`src/lib/tests.ts`). |
| F2 | Isolation | Hospital scoping failed **open**: any role other than Nurse/Physician (or a session with no role) was treated as "see all hospitals". | Inverted: only Admin and Specter Support are unscoped; everything else is scoped (`src/lib/rbac.ts`). |
| F3 | Auth | Deactivating a user, resetting their password or changing their role/hospital had **no effect for up to 8 hours** (JWT kept working). | Every server-side session read re-validates against the DB (`revalidateSession`); password reset bumps `sessionVersion`. |
| F4 | Auth | No brute-force protection on sign-in. | 5 failures → 15-minute lock, for staff and patients; reset unlocks. Failed attempts audited; timing equalised for unknown accounts. |
| F5 | Auth | Open redirect: `/login?callbackUrl=https://evil.example` sent the user off-site after sign-in. | Only same-origin relative paths are accepted (`src/lib/safe-redirect.ts`). |
| F6 | Headers | No CSP or HSTS; `X-Powered-By` exposed. | CSP (self-only, `frame-ancestors 'none'`), HSTS and COOP added; powered-by header off (`next.config.mjs`). |
| F7 | Dependencies | **Critical** advisories in `next` (server-action DoS/SSRF, cache confusion) and `next-auth`. | Upgraded within the same majors: `next` 15.5.29, `next-auth` 4.24.15. |
| F8 | API | Routes read `session.user.role` directly; a session without a staff role could fall through. | All routes use `staffFromSession()`; patient sessions get 403 on every staff API. |
| — | Feature | No PWA, no patient access. | Installable PWA + patient portal (see README). |

**Verified by:** 266 data-layer checks (`npm test`), 71 HTTP checks against a running production build (`npm run test:http`), and a Chrome run covering zero installability errors, the service worker, offline fallback, the cache holding no patient data, and both portal flows.

## 2. Still missing — prioritised

### High (fix before real patient data / production)

1. **Physician sign-off does not exist.** The schema, README and PDF have `signedBy`, `signedAt` and `signatureName`, but no code ever writes them, so every PDF's signature block is empty. Reports finalize when the nurse marks collection complete, with no physician review step. Decide on the clinical workflow (e.g. *Collection complete → Awaiting review → Signed*) and implement it.
2. **No way to correct a finalized report.** FINALIZED is terminal (the README still describes a reopen-with-reason flow, which the code doesn't have). Clinical systems need an **amendment/addendum** path with an audit reason. Today a wrong value can only be fixed in the database.
3. **No database migrations.** The project uses `prisma db push`, with no `prisma/migrations` history. Production schema changes, including this branch's, are unreviewed and can't be rolled back. Adopt `prisma migrate` before go-live.
4. **Seed creates known-password accounts.** `prisma/seed.ts` upserts `admin@specter.health` etc. with `Passw0rd!`. Running it against production creates a known admin login. Guard it with `NODE_ENV`/an explicit flag, and never ship demo users.
5. **No MFA for staff.** Admin and Physician accounts protect PHI for every hospital with a password only. Add TOTP or WebAuthn, at least for Admin and Support.
6. **Remaining dependency advisories (5 high, 1 moderate).** These need breaking upgrades: `zod` 3→4 (memory exhaustion on oversized collections), `postcss` (bundled with Next), `deepmerge-ts` (via Prisma). Schedule the zod 4 migration; current inputs are size-capped, which limits the exposure.
7. **Hospital deactivation doesn't lock out its staff.** `Hospital.isActive=false` hides it from pickers, but its nurses and physicians can still sign in and see its patients. Patients of a deactivated hospital are already blocked; apply the same to staff.

### Medium

8. **Rate limiting is per account only.** Password spraying (one guess against many accounts) and request floods aren't limited. Add IP-based limits at the edge (Vercel WAF, Cloudflare, or middleware + Redis).
9. **CSP still allows `'unsafe-inline'` scripts.** Next's inline bootstrap requires it until nonces are wired through middleware. It's the remaining XSS defence gap.
10. **No staff self-service.** There's no "forgot password", and staff can't change their own password (only an admin can reset it). Both need email delivery (below).
11. **No email/SMS delivery.** "Share by email" opens a `mailto:` draft, and patients aren't notified when a report is ready. Integrate a transactional email/SMS provider. The portal is ready for a "your report is ready" notice.
12. **No idle timeout on shared workstations.** Sessions last 8 hours regardless of activity. Add an idle auto-logout (e.g. 15 minutes) for staff.
13. **Audit log isn't usable at scale.** It's capped at 250 rows with no pagination, date range, hospital filter or export, and there's no retention policy. The per-test trail is capped at 100 rows.
14. **Search decrypts every record in memory.** Name search loads and decrypts the actor's whole patient/test set on each query. That's fine for hundreds of records, slow at tens of thousands. Consider an encrypted search index (e.g. blind-indexed name tokens).
15. **Departments can only be added.** They can't be renamed, deactivated or deleted from the UI.
16. **Fragile scoping pattern.** `loadReportData()` doesn't check scope itself; every caller must remember to. Move the scope check into the loader, as `getTestDetail` does, so a future route can't forget it.
17. **No CI.** The test suites are scripts run by hand. Add a GitHub Action that runs `npm run build`, `npm test` against a throwaway Postgres, and `npm audit`.

### Low / product gaps

18. **No Arabic / RTL support.** It's expected for UAE hospitals, both for patients in the portal and on PDFs.
19. **No error monitoring.** Server errors only go to `console.error`. Add Sentry or similar, with PHI scrubbing.
20. **No patient merge or duplicate handling**, and no deletion or export path for data-subject requests. Check what UAE PDPL / DoH requirements apply.
21. **No backups/DR runbook or UAE data residency yet.** The README already lists these as deployment-phase tasks.
22. **Clinical thresholds are placeholders.** As the seed notes, interpretation rules need sign-off from clinical stakeholders.
23. **PWA extras.** Add manifest `screenshots` (gives Chrome the richer install sheet) and an in-app "update available — reload" prompt when a new service worker ships.

## 3. Isolation model (for reviewers)

- **Staff:** every patient/test/report query goes through `hospitalScope()` / `isOutsideScope()` (`src/lib/session.ts`). Anything out of scope answers *not found*, never *forbidden*, so record ids can't be probed.
- **Patients:** a separate session kind. Middleware confines them to `/portal` and `/api/portal`. Every portal query is keyed on the `patientId` from the signed session, never on request input, and only `FINALIZED` reports are returned. The JWT holds no patient name.
- **Revocation:** account active state and `sessionVersion` are re-checked on every request.
