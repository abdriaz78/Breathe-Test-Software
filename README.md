# QuinTron Breath Test — Specter Clinical Platform

Software for QuinTron breath-test analyzers used in hospitals. Nurses / lab
technicians enter breath-test data and generate professional PDF reports;
physicians review, add the diagnosis/recommendation, and sign. The system
**never auto-diagnoses** — it only surfaces interpretation-support flags based on
approved thresholds.

> **Status:** Phase 1 — POC. This session established the project scaffold, the
> full data model, and the authentication / RBAC / audit / encryption
> foundation. Feature modules are being built one by one (see Roadmap).

---

## Tech stack

| Layer     | Choice                                            |
| --------- | ------------------------------------------------- |
| Framework | Next.js 15 (App Router) + React 19 + TypeScript   |
| Styling   | Tailwind CSS                                       |
| Database  | PostgreSQL via Prisma ORM                          |
| Auth      | NextAuth (credentials, JWT sessions) + RBAC        |
| Security  | AES-256-GCM field-level PHI encryption, audit log  |
| Hosting   | Vercel (POC). UAE-region deployment deferred.      |

## Project structure

```
prisma/
  schema.prisma        # Full data model (users, patients, tests, samples, audit…)
  seed.ts              # Demo hospital, one user per role, 4 built-in test types
src/
  app/
    layout.tsx         # Root layout + session provider
    page.tsx           # Role-aware dashboard
    login/             # Sign-in page
    api/auth/          # NextAuth route handler
  components/          # Shared UI (SignOutButton, …)
  lib/
    prisma.ts          # Prisma client singleton
    crypto.ts          # AES-256-GCM encrypt/decrypt + MRN blind index
    auth.ts            # NextAuth config + server session helper
    rbac.ts            # Roles → permissions, can()/assertCan()
    audit.ts           # recordAudit() helper
    interpretation.ts  # Threshold → support-flags engine (NOT a diagnosis)
  types/               # NextAuth type augmentation
  middleware.ts        # Requires a session for all app routes
```

## Data model highlights

- **Patient PHI is encrypted at rest.** `nameEnc`, `dobEnc`,
  `referringPhysicianEnc` hold AES-256-GCM ciphertext; MRN also has an HMAC
  `mrnHash` blind index for lookups without decryption.
- **Report lifecycle:** `DRAFT → IN_PROGRESS → FINALIZED`. Finalizing locks
  editing. Reopening requires a reason and writes a `REOPEN` audit record.
- **Test types** are a catalog: four built-ins (`isSystem`) plus admin-defined
  custom types. Each carries `interpretationRules` powering support flags only.
- **AuditLog** captures every clinical mutation, login, export, PHI view,
  finalize, and reopen — never storing plaintext PHI.

## Roles & permissions

| Role                | Highlights                                                     |
| ------------------- | ------------------------------------------------------------- |
| **Admin**           | User/test-type/hospital management, audit, all clinical CRUD  |
| **Nurse / Lab Tech**| Register patients, create tests, enter samples, export        |
| **Physician**       | Review, author diagnosis, sign & finalize, reopen, audit      |
| **Specter Support** | Read-only clinical + config (test types, hospitals), audit    |
| **Patient (portal)**| Own **finalized** reports only — view/download PDF            |

Nurse and Physician accounts are **hospital-scoped**: every list, search,
export, PDF and page is restricted to their own hospital, and anything outside
it answers "not found". Scoping fails closed — any role that is not explicitly
cross-hospital (Admin, Specter Support) is treated as scoped.

## Patient portal

Patients sign in at **`/portal/login`** with their **MRN + a password issued by
hospital staff** and can only see their own finalized reports.

1. On the patient's record, staff (Admin / Nurse / Physician of that hospital)
   click **Enable portal access**. A one-time temporary password is shown once.
2. The patient signs in and must choose their own password before seeing anything.
3. **Reset password** issues a new temporary password, unlocks the account and
   signs the patient out everywhere; **Disable** revokes access immediately.

Patient sessions are a separate session *kind*: they can never satisfy a staff
permission check, middleware fences them into `/portal` and `/api/portal`, and
the patient name is never placed in the session token.

## Installable app (PWA)

The app is a Progressive Web App: web app manifest (`src/app/manifest.ts`),
standard + maskable icons (`public/icons/`), a service worker (`public/sw.js`)
and an offline page (`public/offline.html`). Both sign-in screens show an
**Install app** button — it triggers the browser's native install prompt
(Chrome / Edge / Android) or shows step-by-step instructions (iPhone/iPad
Safari, macOS Safari, Firefox).

**Privacy:** the service worker never caches pages, API responses, PDFs or CSVs
— only content-hashed build assets, icons and the offline page — so no patient
data is stored on a shared workstation or phone. The service worker registers
in production builds only (`npm run build && npm start`); installing requires
HTTPS (or `localhost`).

## Sign-in security

- 5 consecutive failed sign-ins lock the account for 15 minutes (staff and
  patients). An admin password reset / staff portal reset unlocks it.
- Every request re-validates the session against the database: deactivating a
  user, resetting a password or disabling portal access signs them out at once;
  role and hospital changes apply without re-login.
- `callbackUrl` after sign-in only accepts same-origin relative paths.

See [`src/lib/rbac.ts`](src/lib/rbac.ts) for the exact permission matrix.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   - DATABASE_URL       -> a PostgreSQL instance (Vercel Postgres / Neon / local)
#   - NEXTAUTH_SECRET    -> openssl rand -base64 32
#   - PHI_ENCRYPTION_KEY -> openssl rand -base64 32   (must be 32 bytes)

# 3. Create the schema and seed demo data
npm run db:push
npm run db:seed

# 4. Run
npm run dev            # http://localhost:3000
```

> **Upgrading an existing database:** this release adds the `PatientAccount`
> table and lockout/session columns on `User`. Run `npm run db:push` against
> each environment's database before deploying the new code.

### Tests

```bash
npm test                                     # data-layer suites (needs a seeded DB)
BASE_URL=http://localhost:3000 npm run test:http   # HTTP security + PWA checks against a running server
```

The suites create their own throwaway hospitals/patients, so point them at a
dev/test database, never production.

### Demo logins (after seeding)

Password for all: `Passw0rd!` (override with `SEED_PASSWORD`).

| Role        | Email                     |
| ----------- | ------------------------- |
| Admin       | admin@specter.health      |
| Nurse       | nurse@specter.health      |
| Physician   | physician@specter.health  |
| Support     | support@specter.health    |

## Roadmap (Phase 1 feature modules)

1. ✅ Project scaffold, data model, auth/RBAC/audit/encryption foundation
2. ✅ Patient registration (create/list/detail, encrypted PHI round-trip)
3. ✅ Test creation (type/substrate/dose/dates/technician/pre-test notes)
4. ✅ Sample entry table (H₂, CH₄, H₂+CH₄ auto-calc, CO₂, correction factor)
5. ✅ Chart generation (H₂, CH₄, H₂+CH₄ over time)
6. ✅ PDF report (branding, details, chart, table, diagnosis box, signature)
7. ✅ Report status workflow + reopen-with-reason audit trail
8. ✅ Admin: users, test types, hospitals + global audit log
9. ✅ Export: PDF download, email/share, Excel/CSV
10. ✅ PWA (installable, offline page, no PHI cached) + patient portal
11. 🟨 Hardening: ✅ account lockout, session revocation, CSP/HSTS — ⬜ IP rate limiting, CSP nonces, MFA, UAE-region deployment

## Security & compliance notes

- **Encryption in transit:** enforced by the hosting platform (HTTPS/TLS).
- **Encryption at rest:** field-level for PHI (app layer) + DB-level at deploy.
- **UAE compliance:** deployment to a UAE region (e.g. Azure UAE North or AWS
  me-central-1) with data residency is a deployment-phase task; the app is
  written region-agnostic and config-driven to support it.
- **Interpretation thresholds** shipped in the seed are placeholders and require
  clinical approval before production use.
