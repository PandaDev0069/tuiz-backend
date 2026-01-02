# API (tuiz-backend)

> Contract: All non-2xx responses return  
> `{ "error": "string", "message": "optional", "requestId": "optional" }`

## Base URL

- Local: `http://localhost:8080`

## WebSocket API (Socket.io)

The backend uses Socket.io for real-time events. Clients connect to the Socket.io endpoint exposed by the Express server. Event names must match frontend and backend contracts documented in `AI_TECHNICAL.md`.

**Connection**

- Endpoint: `ws[s]://<backend-host>/socket.io/`
- Auth: Frontend forwards Supabase JWT; backend verifies statelessly.

**Core Events**

- `server:hello`: Emitted by server upon connection to confirm handshake.
- `client:hello`: Emitted by client after receiving `server:hello` to confirm readiness.

**Game Room Lifecycle**

- `game:host:create` (Client → Server)
  - Payload: `{ hostId: string, title: string, settings?: GameSettings }`
  - Response: `game:room:created` `{ roomId: string, code: string }`

- `game:room:join` (Client → Server)
  - Payload: `{ roomCode: string, playerId: string, displayName: string }`
  - Response: `game:room:joined` `{ roomId: string, player: PlayerSummary }`
  - Broadcast: `game:room:participants:update` `{ roomId: string, participants: Participant[] }`

- `game:room:leave` (Client → Server)
  - Payload: `{ roomId: string, playerId: string }`
  - Broadcast: `game:room:participants:update`

**Question Flow**

- `game:flow:start` (Host → Server)
  - Payload: `{ roomId: string, questionId: string, startsAt: number, endsAt: number }`
  - Broadcast: `game:question:started` `{ roomId, question, endsAt }`

- `game:flow:next` (Host → Server)
  - Payload: `{ roomId: string, nextQuestionId: string }`
  - Broadcast: `game:question:changed` `{ roomId, question }`

- `game:flow:end` (Host → Server)
  - Payload: `{ roomId: string }`
  - Broadcast: `game:question:ended` `{ roomId }`

**Answer Submission**

- `game:answer:submit` (Player → Server)
  - Payload: `{ roomId: string, playerId: string, questionId: string, answer: string | number }`
  - Response: `game:answer:accepted` `{ roomId, playerId, questionId, submittedAt }`
  - Broadcast: `game:answer:stats:update` `{ roomId, questionId, counts: Record<string, number> }`

**Leaderboard**

- `game:leaderboard:request` (Client → Server)
  - Payload: `{ roomId: string }`
  - Response: `game:leaderboard:update` `{ roomId, rankings: RankingEntry[] }`

**Connection Management**

- `connection:heartbeat` (Client → Server)
  - Payload: `{ socketId: string, roomId?: string }`
  - Response: `connection:heartbeat:ack` `{ timestamp: number }`

- `connection:reconnect` (Client → Server)
  - Payload: `{ previousSocketId: string, newSocketId: string, roomId?: string, playerId?: string }`
  - Broadcast: participant state corrections as needed

**Error Contract**

- All error emissions follow unified structure: `{ error: string, message?: string, requestId?: string }`
- Example: `{ error: 'invalid_payload', message: 'Invalid request data' }`

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

---

### Game Flow Routes

Game flow routes manage question progression and game state during active gameplay.

#### GET `/game-flows/:game_id/flow`

Get the current game flow state for a specific game.

- **Auth:** Bearer token required
- **Path Parameters:**
  - `game_id` (string, UUID) - Game identifier
- **200 OK:**
  ```json
  {
    "id": "uuid-string",
    "game_id": "game-uuid",
    "quiz_set_id": "quiz-uuid",
    "current_question_index": 2,
    "total_questions": 10,
    "question_start_time": "2025-12-11T10:30:00.000Z",
    "created_at": "2025-12-11T10:00:00.000Z",
    "updated_at": "2025-12-11T10:30:00.000Z"
  }
  ```
- **400 Bad Request:** Invalid game_id format
- **404 Not Found:** Game flow not found
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/game-flows/550e8400-e29b-41d4-a716-446655440000/flow" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GET `/game-flows/`

List all game flows with pagination and filtering.

- **Auth:** Bearer token required
- **Query Parameters:**
  - `quiz_set_id` (string, optional) - Filter by quiz set
  - `limit` (number, optional, default: 20) - Results per page
  - `offset` (number, optional, default: 0) - Pagination offset
- **200 OK:**
  ```json
  {
    "flows": [
      {
        "id": "uuid-string",
        "game_id": "game-uuid",
        "quiz_set_id": "quiz-uuid",
        "current_question_index": 2,
        "total_questions": 10,
        "created_at": "2025-12-11T10:00:00.000Z"
      }
    ],
    "total": 42,
    "limit": 20,
    "offset": 0
  }
  ```
- **400 Bad Request:** Invalid query parameters
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/game-flows/?quiz_set_id=550e8400-e29b-41d4-a716-446655440000&limit=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### POST `/game-flows/:game_id/advance`

Advance to the next question in the game flow.

- **Auth:** Bearer token required
- **Path Parameters:**
  - `game_id` (string, UUID) - Game identifier
- **200 OK:**
  ```json
  {
    "message": "Advanced to next question",
    "flow": {
      "id": "uuid-string",
      "game_id": "game-uuid",
      "current_question_index": 3,
      "total_questions": 10,
      "question_start_time": "2025-12-11T10:35:00.000Z"
    }
  }
  ```
- **400 Bad Request:** Invalid game_id or already at last question
- **404 Not Found:** Game flow not found
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X POST "http://localhost:8080/game-flows/550e8400-e29b-41d4-a716-446655440000/advance" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### PATCH `/game-flows/:game_id`

Update game flow properties (current question index, timer, etc.).

- **Auth:** Bearer token required
- **Path Parameters:**
  - `game_id` (string, UUID) - Game identifier
- **Request Body:**
  ```json
  {
    "current_question_index": 5,
    "question_start_time": "2025-12-11T10:40:00.000Z"
  }
  ```
- **200 OK:**
  ```json
  {
    "message": "Game flow updated successfully",
    "flow": {
      "id": "uuid-string",
      "game_id": "game-uuid",
      "current_question_index": 5,
      "question_start_time": "2025-12-11T10:40:00.000Z",
      "updated_at": "2025-12-11T10:40:01.000Z"
    }
  }
  ```
- **400 Bad Request:** Invalid request body or game_id
- **404 Not Found:** Game flow not found
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X PATCH "http://localhost:8080/game-flows/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_question_index": 5}'
```

#### DELETE `/game-flows/:game_id`

Delete a game flow (typically when game ends or is abandoned).

- **Auth:** Bearer token required
- **Path Parameters:**
  - `game_id` (string, UUID) - Game identifier
- **200 OK:**
  ```json
  {
    "message": "Game flow deleted successfully"
  }
  ```
- **400 Bad Request:** Invalid game_id format
- **404 Not Found:** Game flow not found
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X DELETE "http://localhost:8080/game-flows/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### WebSocket Connection Routes

Track and query WebSocket connection history and status.

#### GET `/websocket-connections/`

List WebSocket connections with filtering and pagination.

- **Auth:** Bearer token required
- **Query Parameters:**
  - `device_id` (string, optional) - Filter by device
  - `user_id` (string, optional) - Filter by user
  - `status` (string, optional) - Filter by status ('connected' | 'disconnected')
  - `limit` (number, optional, default: 20) - Results per page
  - `offset` (number, optional, default: 0) - Pagination offset
- **200 OK:**
  ```json
  {
    "connections": [
      {
        "id": "uuid-string",
        "device_id": "device-uuid",
        "user_id": "user-uuid",
        "socket_id": "socket-id-string",
        "status": "connected",
        "connected_at": "2025-12-11T10:00:00.000Z",
        "disconnected_at": null,
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0..."
      }
    ],
    "total": 156,
    "limit": 20,
    "offset": 0
  }
  ```
- **400 Bad Request:** Invalid query parameters
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/websocket-connections/?status=connected&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GET `/websocket-connections/active`

Get all currently active WebSocket connections.

- **Auth:** Bearer token required
- **200 OK:**
  ```json
  {
    "connections": [
      {
        "id": "uuid-string",
        "device_id": "device-uuid",
        "user_id": "user-uuid",
        "socket_id": "socket-id-string",
        "status": "connected",
        "connected_at": "2025-12-11T10:00:00.000Z"
      }
    ],
    "count": 42
  }
  ```
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/websocket-connections/active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GET `/websocket-connections/device/:device_id`

Get all connections for a specific device.

- **Auth:** Bearer token required
- **Path Parameters:**
  - `device_id` (string, UUID) - Device identifier
- **200 OK:**
  ```json
  {
    "connections": [
      {
        "id": "uuid-string",
        "device_id": "device-uuid",
        "socket_id": "socket-id-string",
        "status": "disconnected",
        "connected_at": "2025-12-11T09:00:00.000Z",
        "disconnected_at": "2025-12-11T09:45:00.000Z"
      }
    ],
    "count": 8
  }
  ```
- **400 Bad Request:** Invalid device_id format
- **404 Not Found:** Device not found or no connections
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/websocket-connections/device/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GET `/websocket-connections/stats`

Get WebSocket connection statistics (total, active, avg duration).

- **Auth:** Bearer token required
- **200 OK:**
  ```json
  {
    "total_connections": 1523,
    "active_connections": 42,
    "total_disconnected": 1481,
    "avg_duration_minutes": 23.5
  }
  ```
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/websocket-connections/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GET `/websocket-connections/:id`

Get a specific WebSocket connection by ID.

- **Auth:** Bearer token required
- **Path Parameters:**
  - `id` (string, UUID) - Connection identifier
- **200 OK:**
  ```json
  {
    "id": "uuid-string",
    "device_id": "device-uuid",
    "user_id": "user-uuid",
    "socket_id": "socket-id-string",
    "status": "connected",
    "connected_at": "2025-12-11T10:00:00.000Z",
    "disconnected_at": null,
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "created_at": "2025-12-11T10:00:00.000Z"
  }
  ```
- **400 Bad Request:** Invalid connection ID format
- **404 Not Found:** Connection not found
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/websocket-connections/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Device Session Routes

Manage device session tracking and metadata across connections.

#### GET `/device-sessions/`

List all device sessions with optional filtering.

- **Auth:** Bearer token required
- **Query Parameters:**
  - `user_id` (string, optional) - Filter by user
  - `limit` (number, optional, default: 20) - Results per page
  - `offset` (number, optional, default: 0) - Pagination offset
- **200 OK:**
  ```json
  {
    "sessions": [
      {
        "id": "uuid-string",
        "device_id": "device-uuid",
        "user_id": "user-uuid",
        "device_type": "mobile",
        "os": "iOS",
        "browser": "Safari",
        "first_seen": "2025-12-01T10:00:00.000Z",
        "last_seen": "2025-12-11T10:00:00.000Z",
        "session_count": 42,
        "metadata": {
          "app_version": "2.1.0",
          "device_name": "iPhone 15"
        }
      }
    ],
    "total": 89,
    "limit": 20,
    "offset": 0
  }
  ```
- **400 Bad Request:** Invalid query parameters
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/device-sessions/?user_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GET `/device-sessions/:device_id`

Get a specific device session by device ID.

- **Auth:** Bearer token required
- **Path Parameters:**
  - `device_id` (string, UUID) - Device identifier
- **200 OK:**
  ```json
  {
    "id": "uuid-string",
    "device_id": "device-uuid",
    "user_id": "user-uuid",
    "device_type": "desktop",
    "os": "Windows 11",
    "browser": "Chrome",
    "first_seen": "2025-11-15T08:00:00.000Z",
    "last_seen": "2025-12-11T10:30:00.000Z",
    "session_count": 156,
    "metadata": {
      "screen_resolution": "1920x1080",
      "timezone": "Asia/Tokyo"
    },
    "created_at": "2025-11-15T08:00:00.000Z",
    "updated_at": "2025-12-11T10:30:00.000Z"
  }
  ```
- **400 Bad Request:** Invalid device_id format
- **404 Not Found:** Device session not found
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/device-sessions/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### PATCH `/device-sessions/:device_id/metadata`

Update device session metadata (app version, preferences, etc.).

- **Auth:** Bearer token required
- **Path Parameters:**
  - `device_id` (string, UUID) - Device identifier
- **Request Body:**
  ```json
  {
    "app_version": "2.2.0",
    "language": "ja-JP",
    "theme": "dark"
  }
  ```
- **200 OK:**
  ```json
  {
    "message": "Device session metadata updated",
    "session": {
      "id": "uuid-string",
      "device_id": "device-uuid",
      "metadata": {
        "app_version": "2.2.0",
        "language": "ja-JP",
        "theme": "dark"
      },
      "updated_at": "2025-12-11T10:45:00.000Z"
    }
  }
  ```
- **400 Bad Request:** Invalid request body or device_id
- **404 Not Found:** Device session not found
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X PATCH "http://localhost:8080/device-sessions/550e8400-e29b-41d4-a716-446655440000/metadata" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"app_version": "2.2.0", "language": "ja-JP"}'
```

#### GET `/device-sessions/:device_id/connections`

Get all WebSocket connections for a specific device session.

- **Auth:** Bearer token required
- **Path Parameters:**
  - `device_id` (string, UUID) - Device identifier
- **200 OK:**
  ```json
  {
    "connections": [
      {
        "id": "uuid-string",
        "socket_id": "socket-id-string",
        "status": "disconnected",
        "connected_at": "2025-12-11T09:00:00.000Z",
        "disconnected_at": "2025-12-11T09:45:00.000Z",
        "duration_minutes": 45
      }
    ],
    "count": 8,
    "device_id": "device-uuid"
  }
  ```
- **400 Bad Request:** Invalid device_id format
- **404 Not Found:** Device session not found
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/device-sessions/550e8400-e29b-41d4-a716-446655440000/connections" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### GET `/device-sessions/stats`

Get device session statistics (total devices, active users, avg sessions).

- **Auth:** Bearer token required
- **200 OK:**
  ```json
  {
    "total_devices": 342,
    "unique_users": 278,
    "avg_sessions_per_device": 12.5,
    "most_common_os": "iOS",
    "most_common_browser": "Chrome"
  }
  ```
- **500 Server Error:** Database error

**cURL Example:**

```bash
curl -X GET "http://localhost:8080/device-sessions/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

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

### Game Flow Management

| Method | Endpoint                       | Description      | Auth     |
| ------ | ------------------------------ | ---------------- | -------- |
| GET    | `/game-flows/:game_id/flow`    | Get game flow    | Required |
| GET    | `/game-flows/`                 | List game flows  | Required |
| POST   | `/game-flows/:game_id/advance` | Advance question | Required |
| PATCH  | `/game-flows/:game_id`         | Update game flow | Required |
| DELETE | `/game-flows/:game_id`         | Delete game flow | Required |

### WebSocket Connections

| Method | Endpoint                            | Description            | Auth     |
| ------ | ----------------------------------- | ---------------------- | -------- |
| GET    | `/websocket-connections/`           | List connections       | Required |
| GET    | `/websocket-connections/active`     | Get active connections | Required |
| GET    | `/websocket-connections/device/:id` | Get device connections | Required |
| GET    | `/websocket-connections/stats`      | Get connection stats   | Required |
| GET    | `/websocket-connections/:id`        | Get connection by ID   | Required |

### Device Sessions

| Method | Endpoint                                  | Description             | Auth     |
| ------ | ----------------------------------------- | ----------------------- | -------- |
| GET    | `/device-sessions/`                       | List device sessions    | Required |
| GET    | `/device-sessions/:device_id`             | Get session by device   | Required |
| PATCH  | `/device-sessions/:device_id/metadata`    | Update session metadata | Required |
| GET    | `/device-sessions/:device_id/connections` | Get session connections | Required |
| GET    | `/device-sessions/stats`                  | Get session stats       | Required |

### Health Check

| Method | Endpoint  | Description  | Auth |
| ------ | --------- | ------------ | ---- |
| GET    | `/health` | Health check | None |

## Conventions

- **Versioning:** add `X-Contract-Version` header in future (optional).
- **CORS:** allowlist defined by `CLIENT_ORIGINS`.
- **Errors:** never leak stack traces in prod.
