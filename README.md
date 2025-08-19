# tuiz-backend

Express + TypeScript + Socket.IO backend for **TUIZ** (quiz game). Independent repo from the frontend.

## ✨ Tech

- Node.js 22 (Active LTS)
- Express (App Factory)
- TypeScript (strict)
- Socket.IO (planned)
- ESLint (flat config) + Prettier
- Husky + lint-staged + Conventional Commits
- GitHub Actions (typecheck, lint, build)

## 🧰 Requirements

- Node >= 22
- npm (bundled with Node)

## 🚀 Quick Start (dev)

```bash
npm install
# create envs
cp .env.example .env   # (PowerShell: copy .env.example .env)
# run dev (after app/server code is added)
npm run dev
```

## 🔧 Scripts

- `npm run dev` – ts-node-dev (hot reload)
- `npm run build` – compile to `dist/`
- `npm run start` – run compiled server
- `npm run typecheck` – TS type check
- `npm run lint` – ESLint (flat config)
- `npm run format` / `format:write` – Prettier check/fix

## 🔐 Environment

See `.env.example` for all keys. Minimum for local dev:

```
PORT=8080
CLIENT_ORIGINS=http://localhost:3000
```

## 🧭 Project Layout

```
src/
  app.ts            # express app factory (no listen)
  server.ts         # http listen + socket (soon)
  config/
    env.ts          # env parsing/validation (single source of truth)
    cors.ts         # CORS policy (prod allowlist)
  utils/
    logger.ts       # pino wrapper + requestId
    errors.ts       # typed error helpers → unified JSON
  middleware/
    auth.ts         # JWT verification & role guards (Supabase)
    rateLimit.ts    # route-specific limits
    validate.ts     # zod wrapper for routes
  modules/
    health/
      routes.ts     # GET /health, /ready
    quiz/           # routes/service/repo/schemas (stubs)
    games/          # routes/service/repo/events (stubs)

docs/
  API.md            # HTTP route table
  EVENTS.md         # Socket namespaces/events/payloads
  ENGINEERING.md    # conventions: modules, errors, logging
```

## 📦 Error Contract

All non-2xx responses follow this minimal shape:

```json
{ "error": "string", "message": "optional detail", "requestId": "optional" }
```

## 🛡️ Security

- CORS allowlist in production
- Rate limits on `/auth/*` and host-control routes
- Strict input validation with `zod` on every route

## 🧪 Testing

- Unit/integration with Vitest + Supertest (planned)
- App factory pattern enables HTTP testing without network

## 📄 License

See [LICENSE](./LICENSE).
