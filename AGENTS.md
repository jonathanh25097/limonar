<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project rules

Read `docs/ARCHITECTURE.md` before changing code. In short:

- The UI only talks to `/api/v1` through `src/client/api.ts`. Never import `src/server` from `src/features`, `src/components` or pages.
- Business rules go in `src/core` (pure TypeScript, no Next.js or MongoDB imports) and get unit tests.
- Every endpoint validates with a schema from `src/contracts`, and is listed in `src/contracts/openapi.ts`.
- Money is integer centavos with a currency. Every state change is guarded on `{ status, version }`, runs in `withTransaction`, and writes `audit(...)`.
- Every operational document carries a `divisionId`. Lemons is live, cattle is planned. Don't hard-code lemon assumptions outside `core/divisions.ts` and lemon-specific screens.
- UI copy is in Spanish (Nicaragua, voseo: "Elegí", "Entrá"). Code, comments and API error messages are in English.
- Run `npm run typecheck`, `npm run lint` and `npm test` before committing.
