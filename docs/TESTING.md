# Testing (tuiz-backend)

## Goals

- Fast feedback on API behavior and error contracts.
- Minimal ceremony: no real network ports; test the app factory directly.

## Tools

- **Vitest** – test runner
- **Supertest** – HTTP assertions against the Express app (no listen)
- (Optional later) **socket.io-client** – realtime smoke tests

## Test Types

1. **Unit** (utils, schema transforms): tiny, isolated.
2. **HTTP integration**: `supertest(createApp())` covering routes, middleware, and error contract.
3. **Socket smoke** (later): connect/disconnect, one event round-trip.

## Layout

```
tests/
  health.test.ts
  not-found.test.ts
  # more module-focused tests here (e.g., modules/games/*.test.ts)
```

## Commands

```bash
npm test         # run once (CI)
npm run test:ui  # Vitest UI (optional)
# add "test:watch": "vitest" if you want watch mode
```

## Patterns

### 1) App Factory

Use the exported `createApp()` so tests don't bind a port:

```typescript
import request from 'supertest';
import { createApp } from '../src/app';

test('GET /health', async () => {
  const app = createApp();
  const res = await request(app).get('/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual(expect.objectContaining({ ok: true }));
});
```

### 2) Unified Error Contract

Every non-2xx response must match:

```typescript
expect(res.body).toMatchObject({
  error: expect.any(String),
  // message and requestId may be present
});
```

### 3) Validation Tests (when you add zod)

- **Happy path**: valid input → 200/201 with expected body.
- **Bad input**: invalid shape → 400 with `{ error: 'validation_error', message }`.

### 4) Auth (when added)

- **No token** → 401 `{ error: 'unauthorized' }`
- **Expired/invalid token** → 401
- **Valid token but insufficient role** → 403

### 5) Rate Limits (when added)

- **Exceed profile** → 429 `{ error: 'rate_limited' }`
- Document per-route profiles in ENGINEERING.md, and assert status/retry headers.

## CI

Ensure workflow runs: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

Keep tests deterministic and fast (no real DB unless absolutely necessary).

## Tips

- Prefer small, focused tests; avoid deep setups.
- If a route depends on external services, abstract behind a repo and mock/stub there.
- Keep fixtures near tests or under `tests/fixtures/`.
