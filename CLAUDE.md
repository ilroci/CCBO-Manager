# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Canoa Club management app (equipment inventory, personal rentals, club outings). Two independent
npm projects: `backend/` (Express 5 + Prisma 6 + PostgreSQL) and `frontend/` (React 19 + Vite 7 +
Tailwind v4 + Shadcn UI). There is no shared package. The code, comments, UI text, error messages
and commit messages are all in **Italian**: keep that convention.

`README.md` is the authoritative spec for business rules and the API table, and `AVVIO_LOCALE.md`
covers local setup and demo users. Update the README when you change a rule or an endpoint.

## Commands

The recommended dev environment is Docker Compose: db, backend, frontend and Mailpit, with
`src/` mounted for hot reload.

```bash
docker compose up --build                       # http://localhost:5173 · API :3000 · Mailpit :8025
docker compose exec backend npm run typecheck
docker compose exec frontend npm run typecheck
docker compose exec backend npm test            # node:test via tsx (src/**/*.test.ts)
docker compose exec backend npx tsx --test src/lib/pricing.test.ts   # single test file
docker compose exec backend npx prisma migrate dev --name <nome>     # after editing schema.prisma
docker compose exec backend npm run seed
docker compose exec db psql -U canoa -d canoa
ADMIN_ONLY_EDITS=true docker compose up         # read-only mode (see below)
```

Without Docker (Node ≥ 20.19): `npm run dev` / `npm run build` / `npm run typecheck` in each
folder. The backend's `npm install` runs `prisma generate` (postinstall). There is no linter
configured. Rebuild the containers (`--build`) after changing a `package.json` or `Dockerfile`.
On startup the backend dev container runs `prisma migrate deploy && npm run seed`. The seed
never overwrites existing users.

## Backend architecture

- `src/app.ts` wires the routers under `/api/*`. `src/config/env.ts` validates env vars at
  startup (`JWT_SECRET` ≥ 32 chars; `FRONTEND_URL` may list several comma-separated origins).
- **Routes** (`src/routes/*.routes.ts`) validate input with **zod** (`schema.parse(req.body)`,
  Italian locale) and throw errors. They do not build error responses themselves.
  `middleware/error-handler.ts` maps `HttpError` (from `lib/http-error.ts`: `badRequest`,
  `notFound`, …), `ZodError` (400 with `details`), and Prisma unique violations (409) to
  `{ error, details? }`. Express 5 forwards async throws automatically.
- **Domain logic** lives in `src/lib/` (`rentals.ts`, `outings.ts`, `pricing.ts`, `equipment.ts`,
  `dates.ts`). Each domain exposes a Prisma `*Include` object plus a `to*Dto()` mapper, and routes
  return the DTOs, never raw Prisma rows. Helpers take a `Db` parameter (the client or a
  transaction) so they can run inside `prisma.$transaction`.
- **Auth**: the client sends a JWT as a Bearer token. `authenticate` re-reads the user from the DB
  on every request, so role or active-status changes take effect immediately.
  `authorize(...roles)` is the real permission check. `adminOnlyWrites` (mounted on `/api`)
  enforces `ADMIN_ONLY_EDITS`: with the flag on, every non-GET request except `/auth/*` and
  `/suggestions` is admin-only. The flag is returned to the frontend by `/api/auth/login` and
  `/api/auth/me`.
- **Dates**: rental and outing dates are `@db.Date` calendar days handled as UTC midnight
  (`parseDate`/`formatDate`), with inclusive day counts (`calendarDays`). "Today" is computed in
  Europe/Rome time (`todayInItaly`) because the server runs in UTC.
- **Money**: `Decimal(10,2)`, never Float. The API serialises amounts as strings ("15.00").
- **Price snapshots**: the price-list lines that were charged are copied into `RentalCharge`, and
  outing participants store the service amounts they were charged. Changing the price list must
  not alter history.
- **Double-booking prevention**: Prisma cannot express range-exclusion constraints, so
  `lockAndAssertAvailable` does `SELECT … FOR UPDATE` on the item rows inside the transaction and
  only then checks for overlaps. Any new code that books items must go through it.
- **Outings**: a participant's rental is a `Rental` of kind `OUTING`. Its price-list lines are
  stored in `RentalCharge`, and the optional specific items in `RentalItem` (these block those
  items for the outing's dates). `travelMode` (`VAN` | `TRANSPORT_ONLY` | `AUTONOMOUS`) makes the
  van and transport services mutually exclusive by construction. Payments (`OutingPayment`) are
  recorded per category (`RENTAL`, `TRANSPORT`, `VAN`), and a paid category locks the related
  fields. `syncParticipant` in `lib/outings.ts` is the central place that reconciles a
  participant's rental and amounts.
- Equipment photos are stored in PostgreSQL (`EquipmentPhoto`), because the Render free tier has
  no persistent disk. They are served publicly at `/api/equipment/:id/photo?v=…`.
- Prisma is pinned to **v6** on purpose: v7 drops `url = env(...)` in the datasource.

## Frontend architecture

- `src/lib/api.ts`: the single axios client (`VITE_API_URL`, which is read at build time). It
  stores the token in localStorage and calls a handler registered by `AuthProvider` on any 401.
  Use `getErrorMessage()` to show backend errors.
- `src/lib/types.ts` mirrors the backend DTOs **by hand**. Update it whenever you change a DTO.
  Domain helpers in `src/lib/*.ts` mirror the backend's (dates, money, outings, rentals).
- `src/auth/permissions.ts` (`NAV_ITEMS`) is the single source for the menu, routes and dashboard
  cards per role. It only hides UI; the backend enforces permissions. `AuthContext` exposes
  `adminOnlyEdits`, and pages must hide editing controls when it is on.
- `src/components/ui/` contains Shadcn components. Import paths use the `@/` alias for `src/`.
  The UI must work on mobile: lists render as cards instead of tables, and dialogs scroll.

## Deploy

Deployed on Render (`render.yaml`) with Neon PostgreSQL. The backend build is
`npm ci --include=dev && npm run build && npx prisma migrate deploy`. The frontend is a static
site that needs the `/* → /index.html` rewrite (`public/_redirects`). Both Dockerfiles also have
a `prod` target. If a build hits `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` on a corporate network, see
`docker/certs/README.md`.
