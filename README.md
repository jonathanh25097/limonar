# Limonar

Pedidos, entregas, cobros y cosecha de la finca, starting with the lemon division.

- Next.js 16 (App Router, Turbopack), React 19, Tailwind 4
- MongoDB Atlas (official `mongodb` driver), zod for the API contract
- All UI goes through the versioned REST API at `/api/v1`, so other clients can connect the same way.
  The OpenAPI description is at `/api/v1/openapi.json`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code is organized and the rules it enforces.

## Getting started

Requires Node 22+.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `MONGODB_URI` (an Atlas connection string) and `AUTH_SECRET` (`openssl rand -base64 48`).
No Atlas handy? Start a throwaway in-memory replica set in another terminal and use the URI it prints:

```bash
npm run db:dev
```

Load the starting users, products and customers:

```bash
npm run seed
```

```bash
npm run dev
```

Sign in at http://localhost:3000 with a seeded phone and PIN `1234` (or `SEED_PIN`):

| Phone       | Person             | Roles          |
| ----------- | ------------------ | -------------- |
| 50580000001 | María Isabel       | owner          |
| 50580000002 | Adrián             | owner          |
| 50580000003 | Ivania             | office, seller |
| 50580000004 | Guillermo          | field          |
| 50580000005 | Sonia              | seller         |
| 50580000006 | Mauricio Hernández | buyer          |
| 50580000007 | Chayito            | agent          |

The phone numbers are placeholders. Replace them with the real ones before going live.

## Scripts

| Command                           | What it does                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`                     | Dev server                                                                            |
| `npm run build` / `npm start`     | Production build and server                                                           |
| `npm test`                        | Unit tests (core rules) and API tests (real route handlers against in-memory MongoDB) |
| `npm run typecheck`               | Generate route types and run `tsc`                                                    |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                                     |
| `npm run seed`                    | Upsert starting data (safe to re-run)                                                 |
| `npm run db:dev`                  | In-memory MongoDB replica set for local work                                          |

## Using the API from another client

```bash
curl -s -X POST localhost:3000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"phone":"50580000003","pin":"1234"}'
```

```bash
curl -s localhost:3000/api/v1/orders -H "Authorization: Bearer $TOKEN"
```

From JavaScript, `createApiClient({ baseUrl, token })` in `src/client/api.ts` gives you the same typed calls the web app uses.
