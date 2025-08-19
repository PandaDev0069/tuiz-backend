# Contributing to tuiz-backend

Thanks for helping improve **TUIZ** 🎉  
This repo follows a lightweight, pragmatic workflow.

---

## Local Setup

1. Install Node 22+ and npm.
2. Clone the repo and install deps:
   ```bash
   npm install
   cp .env.example .env
   ```
3. Run checks locally:
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```

(Dev server will be added later via `npm run dev`.)

## Branching & PRs

- `main` is protected (CI must pass).
- Use short feature branches:
  - `feat/<scope>-<short-desc>`
  - `fix/<scope>-<short-desc>`
  - `chore/<what>`
- Open a PR early; keep it focused and under ~400 LOC when possible.

### PR Checklist

- [ ] Linted & typechecked locally
- [ ] Added/updated docs under `docs/` if routes/events changed
- [ ] Error responses follow the contract `{ error, message?, requestId? }`
- [ ] CORS/security impacts considered (note in PR if applicable)

## Commits

We use **Conventional Commits**:

```
<type>(<scope>): <subject>
```

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

### Examples

- `feat(games): emit score_update after explanation`
- `fix(auth): reject expired token with 401`
- `docs(api): add /games/:id/start`
- `ci: add lint + typecheck to PR workflow`

Husky hooks enforce formatting and commit style.

## Code Style

- TypeScript strict; prefer explicit types at boundaries.
- Organize by modules: routes → validate → service → repo.
- Input validation with `zod` at route edges.
- No floating promises; handle async errors.
- Use `pino` for logging. Never log secrets or PII.

## Errors & Logging

All non-2xx responses must be:

```json
{ "error": "string", "message": "optional detail", "requestId": "optional" }
```

Include a `requestId` in logs and responses where possible.

## Testing (soon)

- Vitest + Supertest planned.
- App factory pattern (`createApp()`) enables HTTP tests without network.

## Docs

Keep these up to date when behavior changes:

- `docs/API.md` – HTTP endpoints (method, auth, request/response)
- `docs/EVENTS.md` – Socket namespaces/events/payloads
- `docs/ENGINEERING.md` – conventions, rate-limit profiles, logging

## Security

- CORS allowlist in production.
- Rate limits on `/auth/*` and host-control routes.
- Validate every input with `zod`.

## Releases

- CHANGELOG is generated from Conventional Commits (manual for now).
- Use semver mindset even before 1.0: `feat` = minor; `fix` = patch; breaking changes must be clearly called out.
