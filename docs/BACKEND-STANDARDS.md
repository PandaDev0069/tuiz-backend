# Backend Coding Standards (Express + TypeScript)

Opinionated, practical rules to keep the API maintainable and secure.

## 1 Project Structure

```
src/
  app.ts            # express app factory (no listen)
  server.ts         # http listen (+ socket.io later)
  config/
    env.ts          # env parsing/validation (single source)
    cors.ts         # CORS allowlist
  utils/
    logger.ts       # pino wrapper (+ requestId ready)
    errors.ts       # typed errors → http mapping (optional)
  middleware/
    error.ts        # unified error contract
    rateLimit.ts    # route-specific profiles
    auth.ts         # JWT verification (Supabase JWKS later)
    validate.ts     # zod wrapper for routes
  modules/
    health/
      routes.ts     # GET /health, /ready
    # more feature modules go here (routes/service/repo/schemas)
  db/
    migrations/     # migrations (if/when added)
```

## 2) Language & Style

- **TypeScript strict** everywhere in `src/`.
- Explicit types at **module boundaries** (routes/services/repos).
- No `any` unless truly unavoidable; prefer `unknown` + narrowing.
- Import order: node built-ins → external deps → internal modules (alphabetize within groups).

## 3) Modules (Clean-ish layering)

- **routes.ts**: Express handlers, **no business logic**. Validate input with `zod`, call service.
- **service.ts**: business logic. Throws typed errors (mapped centrally).
- **repo.ts**: data access (Supabase/SQL). No domain logic.
- **schemas.ts**: zod schemas + inferred types.

## 4) Validation

- Every route validates: `params`, `query`, `body`.
- Use a `validate.ts` helper to parse & type inputs before service.

## 5) Errors

- Central handler returns the **unified contract**:
  ```json
  { "error": "string", "message": "optional detail", "requestId": "optional" }
  ```
- Don't leak stack traces in production responses (only in logs).
- Services throw typed errors; middleware maps them to HTTP codes.

## 6) Logging

- Use **pino** via `utils/logger.ts`.
- Log request lifecycle (planned): `requestId`, `path`, `status`, `ms`.
- Never log secrets or PII. Prefer structured logs.

## 7) Security

- **CORS allowlist** from env (`CLIENT_ORIGINS`).
- **Rate limit** `/auth/*` and host-control routes.
- **Validate** every external input; sanitize outputs.
- **JWT verification** (Supabase JWKS) when auth is introduced.
- **Database Functions**: Always set `SET search_path = ''` in function
  definitions to prevent privilege escalation attacks. See migration
  `20251112030153_fix_function_search_path_security.sql` for examples.
- **SQL Functions**: Use fully qualified table names (`public.table_name`)
  when search_path is empty.

## 8) Async & Reliability

- Use **async/await**; no floating promises.
- **Timeouts** for external I/O; retries where appropriate.
- Keep payloads small; don't block the event loop.

## 9) Socket.IO (when added)

- Separate **namespaces** (`/host`, `/player`) in a `sockets/` folder.
- Keep event payloads small and explicit; document in `docs/EVENTS.md`.
- Broadcast with room targeting: `io.to(roomId).emit(...)`.

## 10) Git Hygiene & CI

- **Conventional Commits** enforced (commitlint).
- **Pre-commit**: Prettier + ESLint (lint-staged).
- **CI**: lint → typecheck → test → build.
- PRs must note risks/rollout and update docs if contracts change.
