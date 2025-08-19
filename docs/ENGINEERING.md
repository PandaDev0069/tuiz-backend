# Coding Standards (Backend)

## 1) Language & Style

- TypeScript (strict) everywhere in `src/`.
- Prefer explicit types at module boundaries (route handlers, services, repos).
- No `any` unless truly unavoidable; use `unknown` + narrow.
- Imports: node built-ins → external deps → internal modules. Alphabetize within groups.

## 2) Naming

- Files/folders: kebab-case (`rate-limit.ts`, `games-service.ts`).
- Types & Interfaces: PascalCase (`GameSession`, `CreateRoomInput`).
- Functions/vars: camelCase.
- Zod schemas: suffix with `Schema` (`CreateGameSchema`), inferred types as `CreateGame` (`z.infer<typeof CreateGameSchema>`).
- Route files: `routes.ts` inside a module folder (e.g., `modules/health/routes.ts`).

## 3) Project Structure (clean architecture-lite)

```
modules/<feature>/
  routes.ts     # HTTP layer (zod validate, call service)
  service.ts    # business logic
  repo.ts       # DB/Supabase access & mapping
  schemas.ts    # zod schemas & inferred types
  events.ts     # (if socket events exist)
```

- Routes → validate → Service → Repo.
- No cross-module imports from other modules' internals; share via `src/utils` or `src/lib`.

## 4) Comments & Docs

- Keep code self-explanatory; JSDoc only for public functions/types or non-obvious logic.
- Use why-comments, not what-comments:
  ```typescript
  // WHY: prevent double-start on same room; backend is source of truth
  ```
- Top of complex files: a 3–5 line context header (problem, approach, invariants).

## 5) Errors

- Throw typed errors from services (e.g., `errors.ts` helpers) and map to HTTP in a central error middleware.
- All non-2xx responses follow:
  ```json
  { "error": "string", "message": "optional detail", "requestId": "optional" }
  ```
- Never leak stack traces to clients in prod; keep them in logs.

## 6) Validation

- Every route validates input with zod (`schemas.ts`), using a thin `validate.ts` wrapper:
- `req.params`, `req.query`, `req.body` → parse → typed object → service.
- Service layer receives already-validated, typed inputs.

## 7) Async & Promises

- Always use `async/await`. No floating promises.
- Wrap route handlers to forward rejections to the error middleware.
- Prefer transactional boundaries in services; keep I/O in repos.

## 8) Logging

- Use `pino` via `utils/logger.ts`.
- Log one line per request (start + end) with `requestId`, route, status, duration.
- Log events with context: `roomId`, `gameId`, `hostId` (never secrets/PII).

## 9) Security

- CORS allowlist (prod) from env.
- Rate-limit `/auth/*` and host-control endpoints (document profiles in this file).
- Sanitize logs; no tokens or secrets.
- Keep env parsing in `config/env.ts` only.

## 10) Testing (soon)

- Vitest + Supertest.
- Test services and routes at least for the happy path + key error paths.
- Use app factory (`createApp`) so tests don't need a real network port.

## 11) Git Hygiene

- Conventional Commits enforced (commitlint).
- Pre-commit: Prettier + ESLint on staged files.
- PRs must state What/Why/How/Risks and update docs if endpoints/events changed.

## 12) Performance & Ops

- Prefer O(1) lookups in hot paths; batch database calls.
- Add timeouts for external calls (Supabase) and handle retries where sensible.
- Socket events: keep payloads small, use room targeting; document event shapes in `docs/EVENTS.md`.
