<!--
File Name : SECURITY.md
Project : TUIZ
Author : PandaDev0069 / Panta Aashish
Created : 2025-08-19
Last Update : 2026-01-03

Description:

- Security policy and vulnerability reporting guidelines
- Outlines supported versions and secure development practices
- Defines reporting process for security issues

Notes:

- Contact maintainers privately for security issues
- Never open public issues for vulnerabilities
- 48-hour acknowledgment target for reports
-->

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

### Authentication & Authorization

- **Stateless JWT Verification**: Backend verifies Supabase JWTs via `supabase.auth.getUser()` - no session storage
- **Frontend-Direct Auth**: Frontend authenticates directly with Supabase, backend validates tokens only
- **No Auth Middleware**: Direct verification in routes prevents middleware bypass vulnerabilities
- **RLS Policies**: Supabase Row Level Security enforces data access controls at database level
- **Generic Error Messages**: Auth failures use generic messages to prevent information disclosure (e.g., "Invalid email or password" instead of "Email not found")

### Input Validation

- All inputs validated with `zod` before processing
- Validation schemas enforce domain rules (username regex, email format, password length)
- No raw SQL queries - all database access through Supabase client

### Error Handling

- Unified error contract across all endpoints:

  ```json
  { "error": "string", "message": "optional detail", "requestId": "optional" }
  ```

- Never expose stack traces or internal errors in production
- Error codes prevent information leakage (e.g., `invalid_credentials` vs specific failure reasons)

### CORS & Network Security

- Strict CORS allowlist in production via `CLIENT_ORIGINS` environment variable
- Wildcard support for development (`http://localhost:*`)
- Socket.IO CORS matches Express configuration
- Rate limiting enforced on `/auth/*` and host control routes

### Logging & Monitoring

- Structured logging with Pino
- Request IDs for tracing (`x-request-id` header)
- Sensitive data redaction: `password`, `token`, `authorization`, `cookie`
- Never log PII or credentials
- CI-friendly logging with `DOTENV_CONFIG_QUIET`

### Credential Management

- **Frontend**: Email-only "Remember Me" (30-day expiration) - passwords never stored
- **Backend**: No credential storage - stateless token verification only
- Tokens transmitted via Authorization header (`Bearer <token>`)
- Environment variables managed via Zod validation with CI fallbacks

### Database Security

- Supabase hosted instance with SSL/TLS
- Admin client (`SUPABASE_SERVICE_ROLE_KEY`) used only for server-side operations
- Anon client (`SUPABASE_ANON_KEY`) respects RLS policies
- Test isolation: Cleanup after integration tests to prevent data leakage
