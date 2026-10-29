# Architecture

Limonar is one Next.js app on MongoDB Atlas. The product spec lives in the
**Lemon System — Specification** doc and the screens in the **Limones — Mockups** canvas.
This file covers how the code is organized and the rules it follows.

## API first

**The UI never touches the database.** Every screen is a client component that
reads and writes through `/api/v1`, the same endpoints any other client (a phone
app, a WhatsApp bot, a spreadsheet import) would use. If the web app can do
something, the API can too.

```
 Browser (src/app/(app), src/features)          Other clients
        │  src/client/api.ts (typed fetch, cookie)     │  Bearer token
        └──────────────────────┬───────────────────────┘
                               ▼
              src/app/api/v1/**/route.ts   ← thin: parse, call service, respond
                               │
              src/server/http/handler.ts   ← auth, error → HTTP status
                               │
              src/server/services/*.ts     ← load, check, persist, audit (MongoDB)
                               │
              src/core/**                  ← business rules, pure TypeScript
```

| Folder                             | What goes there                                                                                                                                                                                         | May import                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/core/`                        | Business rules: money, roles and permissions, document lifecycles, state machines, validation. No I/O, no Next.js, no MongoDB. This is the spec's `lib/core`, so it can move to a shared package later. | nothing outside `core`                               |
| `src/contracts/`                   | The API contract: zod schemas for every request and response, plus the OpenAPI document built from them (`GET /api/v1/openapi.json`).                                                                   | `core`                                               |
| `src/server/`                      | Everything that runs only on the server: MongoDB access, sessions, services, audit log.                                                                                                                 | `core`, `contracts`                                  |
| `src/app/api/v1/`                  | Route handlers. A few lines each: parse with a contract schema, call a service, return `ok(...)`.                                                                                                       | `server`, `contracts`                                |
| `src/client/`                      | The typed API client and formatting helpers. Works in any JS runtime.                                                                                                                                   | `contracts`, `core` (types and pure helpers)         |
| `src/features/`, `src/components/` | UI.                                                                                                                                                                                                     | `client`, `core` (pure helpers only), never `server` |

### API conventions

- Versioned under `/api/v1`.
- Success: `{ "data": … }`. Error: `{ "error": { "code", "message", "details"? } }`.
  Codes: `validation` (400), `unauthenticated` (401), `forbidden` and
  `two_person_rule` (403), `not_found` (404), `conflict`, `invalid_transition`
  and `locked` (409).
- Money is `{ "amount": <integer centavos>, "currency": "NIO" | "USD" }`. Never floats.
- Dates are ISO 8601.
- Lifecycle moves are `POST /<resource>/{id}/actions` with `{ action, expectedVersion, … }`.
  `expectedVersion` is optimistic concurrency: a stale version gets a 409, never a silent overwrite.
- Every document response carries `allowedActions` for the caller, so clients show
  the right buttons without duplicating permission rules.
- Auth: `POST /auth/login` (phone + PIN) returns a token and sets an httpOnly cookie.
  Browsers use the cookie; other clients send `Authorization: Bearer <token>`.
  Roles are re-read from the database on every request.

### Adding an endpoint

1. Rules in `src/core/…` with unit tests.
2. Request/response schemas in `src/contracts/…`.
3. Service in `src/server/services/…`: `assertCan`, load, call core, write
   guarded on status and version, `audit(...)`, all inside `withTransaction`.
4. Route file in `src/app/api/v1/…` using `handler(...)`.
5. Add it to `ROUTES` in `src/contracts/openapi.ts` and to `src/client/api.ts`.
6. An API test next to the routes (see `orders.api.test.ts`).

## Rules the code enforces

These come from the spec's "Controls and audit" section. They are enforced on the server, not only in the UI.

- **Two people per money decision.** `assertNotCreator` in `core/shared/lifecycle.ts`:
  whoever recorded a document can't approve or verify it, owner or not.
- **Nothing approved is edited.** Only drafts can be changed (`assertCanEdit`), and
  every write is guarded on `{ status, version }` in the database query, so a racing
  request can't slip past. Changing an approved order means cancelling it and
  creating a new one with `replacesOrderId`.
- **Audit log.** Every create and state change writes `auditLog` with before/after,
  in the same transaction.
- **Price locked at approval.** The approver fills any missing prices; a price set
  while drafting is kept as agreed.

## Divisions: lemons now, cattle later

Every operational document carries a `divisionId` (`core/divisions.ts`). Only
`lemons` is active. `cattle` is declared as `planned` so nothing has to be
reshaped when it starts.

The model separates two kinds of things:

- **Products**: fungible stock counted by quantity (persa primera, criollo
  manchado; later milk or kg of beef). Products flow through
  orders → deliveries → buyer counts → payments, the same for any division. Each
  division declares which attributes identify its products (lemons: variety and grade)
  and its unit of measure (`unit`, `kg`, `liter`, `head`, `crate`).
- **Assets**: things tracked one by one with their own history
  (`core/assets/asset.ts`). An orchard plant and a cow are both assets: a tag, a
  location in a tree (block → section, or farm → paddock), a status, and an
  append-only event log (status changes, weighings, treatments, moves). The
  orchard map is built on this next; the herd reuses it.

Money-side features (accounts, ledger, expenses, payroll) are division-agnostic
and use cost centers (`limones`, `ganado`, `construcción`, …), so cattle expenses
and payroll can come in before the herd itself does.

## Build order

From the spec: orders → deliveries and buyer counts → payments and balances; stock, expenses and payroll after that.

- [x] Foundation: auth, roles, divisions, products, customers, audit log, API contract
- [x] Orders: draft, submit, send back, approve (locks prices), reject, cancel
- [ ] Deliveries and buyer counts (versioned counts, Faltante/Sobrante flag, reject outcomes)
- [ ] Payment proof upload and verification, allocations, customer balances
- [ ] Accounts and ledger (balances are sums, transfers write two entries)
- [ ] Orchard map and harvest batches (assets + tallies)
- [ ] Stock movements and consignment at Doña Chayito's
- [ ] Expenses and petty cash, payroll runs, month close
- [ ] File uploads for proof photos (needs a storage choice, e.g. S3 or Atlas-backed)
