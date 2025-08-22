# API (tuiz-backend)

> Contract: All non-2xx responses return  
> `{ "error": "string", "message": "optional", "requestId": "optional" }`

## Base URL

- Local: `http://localhost:8080`

## Routes

### Health Check

#### GET `/health`

- **Auth:** none
- **Query/Body:** none
- **200 OK**
  ```json
  { "ok": true, "ts": 1234567890123 }
  ```

### Authentication Routes

#### POST `/auth/register`

Creates a new user account with Supabase Auth and profile.

- **Auth:** none
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123",
    "username": "uniqueUsername",
    "displayName": "John Doe"
  }
  ```
- **201 Created:**
  ```json
  {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "email_confirmed_at": "2024-01-15T10:30:45.123Z"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_in": 3600
    }
  }
  ```
- **400 Bad Request:** Invalid payload or missing fields
- **422 Unprocessable:** Email already registered
- **500 Server Error:** Registration failed

#### POST `/auth/login`

Authenticates user and returns session tokens.

- **Auth:** none
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securePassword123"
  }
  ```
- **200 OK:**
  ```json
  {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com"
    },
    "session": {
      "access_token": "jwt-token",
      "refresh_token": "refresh-token",
      "expires_in": 3600
    }
  }
  ```
- **400 Bad Request:** Invalid email/password format
- **401 Unauthorized:** Invalid credentials
- **500 Server Error:** Authentication failed

#### POST `/auth/logout`

Invalidates the current session.

- **Auth:** Bearer token required
- **Request Body:** none
- **200 OK:**
  ```json
  {
    "message": "Successfully logged out"
  }
  ```
- **401 Unauthorized:** Invalid or expired token
- **500 Server Error:** Logout failed

## Database Integration

### Profile System

- Profiles are automatically created via database trigger on user registration
- Contains `username`, `display_name`, `created_at`, `last_active`
- Protected by Row Level Security (RLS) policies

### RPC Functions

- `update_last_active(user_id)` - Updates user activity timestamp
- Called automatically during authenticated requests

## Error Contract

All error responses follow the unified format above:

```json
{
  "error": "error_code",
  "message": "Human readable error message",
  "requestId": "optional-request-id"
}
```

Common error codes:

- `invalid_payload` - Request validation failed
- `unauthorized` - Missing or invalid authentication
- `forbidden` - Insufficient permissions
- `not_found` - Resource does not exist
- `server_error` - Internal server error

## Testing

All endpoints covered by integration tests with real Supabase:

- Authentication flows with actual user creation/deletion
- Database trigger validation and profile creation
- Error contract compliance across all routes
- End-to-end user journeys (register → login → logout)

Run tests: `npm test` (18+ tests total)

## Conventions

- **Versioning:** add `X-Contract-Version` header in future (optional).
- **CORS:** allowlist defined by `CLIENT_ORIGINS`.
- **Errors:** never leak stack traces in prod.
