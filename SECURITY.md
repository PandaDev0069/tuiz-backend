# Security Policy

## Supported Versions

We support the latest `main` branch of `tuiz-backend`.  
Security fixes are applied on a best-effort basis while the project is in active development.

## Reporting a Vulnerability

If you discover a security issue in this project:

1. **Do not** open a public GitHub issue.
2. Email the maintainers directly (or use a private channel if part of an org).
3. Provide as much detail as possible:
   - Steps to reproduce
   - Impacted endpoints/events
   - Suggested fixes or mitigations (if any)

We aim to acknowledge reports within **48 hours** and patch critical issues as quickly as possible.

## Practices

- All inputs are validated with `zod` before processing.
- Error responses follow a unified contract:
  ```json
  { "error": "string", "message": "optional detail", "requestId": "optional" }
  ```
- CORS allowlist is strict in production.
- Rate limits are enforced on `/auth/*` and host control routes.
- Logs include `requestId` but never secrets or PII.
