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

### Profile Management Routes

#### GET `/profile`

Retrieves the current user's profile information.

- **Auth:** Bearer token required
- **Request Body:** none
- **200 OK:**
  ```json
  {
    "id": "uuid-string",
    "username": "uniqueUsername",
    "displayName": "John Doe",
    "avatarUrl": "https://example.com/avatar.jpg",
    "email": "user@example.com",
    "createdAt": "2024-01-15T10:30:45.123Z",
    "updatedAt": "2024-01-15T10:30:45.123Z"
  }
  ```
- **401 Unauthorized:** Invalid or expired token
- **500 Server Error:** Profile retrieval failed

#### PUT `/profile/username`

Updates the user's username.

- **Auth:** Bearer token required
- **Request Body:**
  ```json
  {
    "username": "newUniqueUsername"
  }
  ```
- **200 OK:**
  ```json
  {
    "username": "newUniqueUsername",
    "message": "Username updated successfully"
  }
  ```
- **400 Bad Request:** Invalid username format or validation failed
- **409 Conflict:** Username already exists
- **401 Unauthorized:** Invalid or expired token
- **500 Server Error:** Username update failed

#### PUT `/profile/display-name`

Updates the user's display name.

- **Auth:** Bearer token required
- **Request Body:**
  ```json
  {
    "displayName": "New Display Name"
  }
  ```
- **200 OK:**
  ```json
  {
    "displayName": "New Display Name",
    "message": "Display name updated successfully"
  }
  ```
- **400 Bad Request:** Invalid display name format
- **401 Unauthorized:** Invalid or expired token
- **500 Server Error:** Display name update failed

#### POST `/profile/avatar`

Uploads a new avatar image for the user.

- **Auth:** Bearer token required
- **Content-Type:** `multipart/form-data`
- **Request Body:**
  - `avatar`: Image file (JPEG, PNG, WebP, GIF)
  - Max size: 5MB
- **200 OK:**
  ```json
  {
    "url": "https://example.com/storage/avatars/user-id/filename.jpg",
    "path": "user-id/filename.jpg"
  }
  ```
- **400 Bad Request:** No file provided or invalid file format
- **413 Payload Too Large:** File size exceeds 5MB limit
- **401 Unauthorized:** Invalid or expired token
- **500 Server Error:** Avatar upload failed

#### DELETE `/profile/avatar`

Removes the user's current avatar.

- **Auth:** Bearer token required
- **Request Body:** none
- **200 OK:**
  ```json
  {
    "message": "Avatar deleted successfully"
  }
  ```
- **404 Not Found:** No avatar to delete
- **401 Unauthorized:** Invalid or expired token
- **500 Server Error:** Avatar deletion failed

## Database Integration

### Profile System

- Profiles are automatically created via database trigger on user registration
- Contains `username`, `display_name`, `avatar_url`, `created_at`, `last_active`
- Protected by Row Level Security (RLS) policies
- Avatar images stored in Supabase Storage (`avatars` bucket)
- Automatic cleanup of old avatars when uploading new ones

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

## Quiz Management Routes

> **Status**: Planned (See [QUIZ_API_IMPLEMENTATION_PLAN.md](./QUIZ_API_IMPLEMENTATION_PLAN.md) for details)

### Quiz CRUD Operations

#### POST `/quiz`

Creates a new quiz in draft status.

- **Auth:** Bearer token required
- **Request Body:**
  ```json
  {
    "title": "Quiz Title",
    "description": "Quiz description",
    "difficulty_level": "easy|medium|hard|expert",
    "category": "Category Name",
    "is_public": false,
    "tags": ["tag1", "tag2"],
    "play_settings": {
      "show_question_only": true,
      "show_explanation": true,
      "time_bonus": false,
      "streak_bonus": false,
      "show_correct_answer": true,
      "max_players": 400
    }
  }
  ```
- **201 Created:** Returns created quiz object
- **400 Bad Request:** Invalid payload
- **401 Unauthorized:** Invalid token

#### GET `/quiz/:id`

Retrieves a quiz by ID.

- **Auth:** Bearer token required (owner or public quiz)
- **200 OK:** Returns quiz metadata (title, description, settings, etc.)
- **404 Not Found:** Quiz not found or not accessible
- **401 Unauthorized:** Invalid token

#### PUT `/quiz/:id`

Updates an existing quiz.

- **Auth:** Bearer token required (owner only)
- **Request Body:** Partial quiz data
- **200 OK:** Returns updated quiz
- **400 Bad Request:** Invalid payload
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Quiz not found

#### DELETE `/quiz/:id`

Soft deletes a quiz.

- **Auth:** Bearer token required (owner only)
- **200 OK:** `{ "success": true }`
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Quiz not found

#### GET `/quiz`

Lists user's quizzes with pagination.

- **Auth:** Bearer token required
- **Query Parameters:**
  - `status`: Filter by status (draft|published|archived)
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
- **200 OK:**
  ```json
  {
    "quizzes": [...],
    "total": 25,
    "page": 1,
    "totalPages": 3
  }
  ```

### Question Management

#### POST `/quiz/:quizId/questions`

Adds a question to a quiz.

- **Auth:** Bearer token required (quiz owner)
- **Request Body:**
  ```json
  {
    "question_text": "What is JavaScript?",
    "question_type": "multiple_choice|true_false",
    "image_url": "optional-image-url",
    "show_question_time": 10,
    "answering_time": 30,
    "points": 1,
    "difficulty": "easy",
    "order_index": 0,
    "explanation_title": "Explanation Title",
    "explanation_text": "Explanation text",
    "explanation_image_url": "optional-image-url",
    "show_explanation_time": 5,
    "answers": [
      {
        "answer_text": "Answer 1",
        "is_correct": true,
        "order_index": 0
      }
    ]
  }
  ```
- **201 Created:** Returns created question
- **400 Bad Request:** Invalid payload
- **403 Forbidden:** Not quiz owner

#### PUT `/quiz/:quizId/questions/:questionId`

Updates a question.

- **Auth:** Bearer token required (quiz owner)
- **Request Body:** Partial question data
- **200 OK:** Returns updated question
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Question not found

#### DELETE `/quiz/:quizId/questions/:questionId`

Deletes a question.

- **Auth:** Bearer token required (quiz owner)
- **200 OK:** `{ "success": true }`
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Question not found

### Answer Management

#### POST `/quiz/:quizId/questions/:questionId/answers`

Adds an answer to a question.

- **Auth:** Bearer token required (quiz owner)
- **Request Body:**
  ```json
  {
    "answer_text": "Answer option text",
    "image_url": "optional-image-url",
    "is_correct": true,
    "order_index": 0
  }
  ```
- **201 Created:** Returns created answer
- **400 Bad Request:** Invalid payload
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Question not found

#### PUT `/quiz/:quizId/questions/:questionId/answers/:answerId`

Updates an answer.

- **Auth:** Bearer token required (quiz owner)
- **Request Body:** Partial answer data
- **200 OK:** Returns updated answer
- **400 Bad Request:** Invalid payload
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Answer not found

#### DELETE `/quiz/:quizId/questions/:questionId/answers/:answerId`

Deletes an answer.

- **Auth:** Bearer token required (quiz owner)
- **200 OK:** `{ "success": true }`
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Answer not found

### Quiz Publishing

#### POST `/quiz/:id/publish`

Publishes a quiz (changes status to published).

- **Auth:** Bearer token required (quiz owner)
- **200 OK:** Returns updated quiz
- **400 Bad Request:** Quiz validation failed
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Quiz not found

#### POST `/quiz/:id/unpublish`

Unpublishes a quiz (changes status to draft).

- **Auth:** Bearer token required (quiz owner)
- **200 OK:** Returns updated quiz
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Quiz not found

#### GET `/quiz/:id/validate`

Validates a quiz before publishing.

- **Auth:** Bearer token required (quiz owner)
- **200 OK:**
  ```json
  {
    "valid": true,
    "errors": []
  }
  ```
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Quiz not found

### Quiz Code Management

#### POST `/quiz/:id/generate-code`

Generates a unique 6-digit code for the quiz.

- **Auth:** Bearer token required (quiz owner)
- **200 OK:**
  ```json
  {
    "code": 123456
  }
  ```
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Quiz not found

#### PUT `/quiz/:id/code`

Sets a custom quiz code.

- **Auth:** Bearer token required (quiz owner)
- **Request Body:**
  ```json
  {
    "code": 123456
  }
  ```
- **200 OK:**
  ```json
  {
    "code": 123456,
    "success": true
  }
  ```
- **400 Bad Request:** Code already exists or invalid format
- **403 Forbidden:** Not quiz owner
- **404 Not Found:** Quiz not found

#### GET `/quiz/code/check/:code`

Checks if a quiz code is available.

- **Auth:** None (public endpoint)
- **200 OK:**
  ```json
  {
    "available": true
  }
  ```
- **400 Bad Request:** Invalid code format

#### GET `/quiz/code/validate/:code`

Validates quiz code format.

- **Auth:** None (public endpoint)
- **200 OK:**
  ```json
  {
    "valid": true,
    "message": "Code format is valid"
  }
  ```
- **400 Bad Request:** Invalid code format

## API Endpoints Summary

### Quiz Management

| Method | Endpoint    | Description  | Auth     |
| ------ | ----------- | ------------ | -------- |
| POST   | `/quiz`     | Create quiz  | Required |
| GET    | `/quiz/:id` | Get quiz     | Required |
| PUT    | `/quiz/:id` | Update quiz  | Owner    |
| DELETE | `/quiz/:id` | Delete quiz  | Owner    |
| GET    | `/quiz`     | List quizzes | Required |

### Question Management

| Method | Endpoint                              | Description       | Auth  |
| ------ | ------------------------------------- | ----------------- | ----- |
| POST   | `/quiz/:quizId/questions`             | Add question      | Owner |
| PUT    | `/quiz/:quizId/questions/:questionId` | Update question   | Owner |
| DELETE | `/quiz/:quizId/questions/:questionId` | Delete question   | Owner |
| PUT    | `/quiz/:quizId/questions/reorder`     | Reorder questions | Owner |

### Answer Management

| Method | Endpoint                                                | Description   | Auth  |
| ------ | ------------------------------------------------------- | ------------- | ----- |
| POST   | `/quiz/:quizId/questions/:questionId/answers`           | Add answer    | Owner |
| PUT    | `/quiz/:quizId/questions/:questionId/answers/:answerId` | Update answer | Owner |
| DELETE | `/quiz/:quizId/questions/:questionId/answers/:answerId` | Delete answer | Owner |

### Publishing

| Method | Endpoint              | Description    | Auth  |
| ------ | --------------------- | -------------- | ----- |
| POST   | `/quiz/:id/publish`   | Publish quiz   | Owner |
| POST   | `/quiz/:id/unpublish` | Unpublish quiz | Owner |
| GET    | `/quiz/:id/validate`  | Validate quiz  | Owner |

### Code Management

| Method | Endpoint                  | Description             | Auth  |
| ------ | ------------------------- | ----------------------- | ----- |
| POST   | `/quiz/:id/generate-code` | Generate unique code    | Owner |
| GET    | `/quiz/code/check/:code`  | Check code availability | None  |
| GET    | `/quiz/:id/code`          | Get current quiz code   | Owner |
| DELETE | `/quiz/:id/code`          | Remove quiz code        | Owner |

### Profile Management

| Method | Endpoint                | Description         | Auth     |
| ------ | ----------------------- | ------------------- | -------- |
| GET    | `/profile`              | Get profile         | Required |
| PUT    | `/profile/username`     | Update username     | Required |
| PUT    | `/profile/display-name` | Update display name | Required |
| POST   | `/profile/avatar`       | Upload avatar       | Required |
| DELETE | `/profile/avatar`       | Delete avatar       | Required |

### Authentication

| Method | Endpoint         | Description | Auth |
| ------ | ---------------- | ----------- | ---- |
| POST   | `/auth/register` | Register    | None |
| POST   | `/auth/login`    | Login       | None |
| POST   | `/auth/logout`   | Logout      | None |

### Health Check

| Method | Endpoint  | Description  | Auth |
| ------ | --------- | ------------ | ---- |
| GET    | `/health` | Health check | None |

## Conventions

- **Versioning:** add `X-Contract-Version` header in future (optional).
- **CORS:** allowlist defined by `CLIENT_ORIGINS`.
- **Errors:** never leak stack traces in prod.
