# API (tuiz-backend)

> Contract: All non-2xx responses return  
> `{ "error": "string", "message": "optional", "requestId": "optional" }`

## Base URL

- Local: `http://localhost:8080`

## Routes

### GET `/health`

- **Auth:** none
- **Query/Body:** none
- **200 OK**
  ```json
  { "ok": true, "ts": 1234567890123 }
  ```

### GET `/health/ready`

- **Auth:** none
- **200 OK**
  ```json
  { "ready": true }
  ```

## Conventions

- **Versioning:** add `X-Contract-Version` header in future (optional).
- **CORS:** allowlist defined by `CLIENT_ORIGINS`.
- **Errors:** never leak stack traces in prod.
