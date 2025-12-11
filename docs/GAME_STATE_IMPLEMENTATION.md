# Game State Management Implementation

## Overview

Complete implementation of game state management routes for controlling quiz flow during gameplay. These endpoints enable the frontend to orchestrate real-time quiz sessions, including starting games, managing question flow, revealing answers, and controlling game status.

**Implementation Date**: 2025-01-25  
**Files Modified**: 3  
**Files Created**: 2  
**Tests Added**: 14  
**Status**: ✅ Complete

---

## Architecture

### Route Structure

```
/games/:gameId/start           POST    Start a game session
/games/:gameId/questions/start POST    Start a specific question
/games/:gameId/questions/reveal POST   Trigger answer reveal
/games/:gameId/status          PATCH   Update game status (pause/resume/end)
/games/:gameId/state           GET     Get current game state + flow
/games/:gameId                 GET     Get game details
/games/:gameId/lock            PATCH   Lock/unlock game room
```

### Service Integration

The routes integrate with:

- **gameFlowService**: Manages question progression and timing
- **games table**: Tracks overall game status and metadata
- **game_flows table**: Stores detailed flow state per game

---

## Endpoint Details

### 1. POST /games/:gameId/start

**Purpose**: Transition game from `waiting` to `active` status

**Authentication**: Required (game owner only)

**Request**:

```http
POST /games/abc123/start
Authorization: Bearer <jwt_token>
```

**Response** (200):

```json
{
  "id": "abc123",
  "status": "active",
  "started_at": "2025-01-25T14:00:00Z",
  "user_id": "user-id",
  "room_code": "ROOM123",
  ...
}
```

**Error Cases**:

- `404 not_found`: Game doesn't exist or not owned by user
- `400 invalid_state`: Game is not in `waiting` state

---

### 2. POST /games/:gameId/questions/start

**Purpose**: Start a specific question and begin timer

**Authentication**: Required (game owner only)

**Request**:

```http
POST /games/abc123/questions/start
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "questionId": "q-1",
  "questionIndex": 0
}
```

**Response** (200):

```json
{
  "id": "flow-1",
  "game_id": "abc123",
  "current_question_id": "q-1",
  "current_question_index": 0,
  "current_question_start_time": "2025-01-25T14:01:00Z",
  ...
}
```

**Updates**:

- Sets `current_question_id` and `current_question_start_time` in `game_flows`
- Sets `current_question_index` in `games` table

**Error Cases**:

- `400 invalid_payload`: Missing `questionId`
- `404 not_found`: Game not found or unauthorized
- `500 update_failed`: Database update failed

---

### 3. POST /games/:gameId/questions/reveal

**Purpose**: Trigger answer reveal for the current question

**Authentication**: Required (game owner only)

**Request**:

```http
POST /games/abc123/questions/reveal
Authorization: Bearer <jwt_token>
```

**Response** (200):

```json
{
  "message": "Answer reveal triggered",
  "gameFlow": {
    "id": "flow-1",
    "game_id": "abc123",
    "current_question_end_time": "2025-01-25T14:01:30Z",
    ...
  }
}
```

**Updates**:

- Sets `current_question_end_time` in `game_flows`

**Frontend Integration**:
This endpoint should emit a WebSocket event `answer:reveal` to all participants after success.

---

### 4. PATCH /games/:gameId/status

**Purpose**: Update game status for pause/resume/end actions

**Authentication**: Required (game owner only)

**Request** (Action-based):

```http
PATCH /games/abc123/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "action": "pause"  // or "resume", "end"
}
```

**Request** (Status-based):

```http
PATCH /games/abc123/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "completed"
}
```

**Response** (200):

```json
{
  "id": "abc123",
  "status": "paused",
  "paused_at": "2025-01-25T14:02:00Z",
  ...
}
```

**Action Mappings**:

- `pause` → status: `paused`, sets `paused_at`
- `resume` → status: `active`, sets `resumed_at`
- `end` → status: `completed`, sets `ended_at`

**Error Cases**:

- `400 invalid_payload`: Missing `status` or `action`
- `404 not_found`: Game not found or unauthorized

---

### 5. GET /games/:gameId/state

**Purpose**: Get comprehensive game state including flow information

**Authentication**: Not required (public read)

**Request**:

```http
GET /games/abc123/state
```

**Response** (200):

```json
{
  "game": {
    "id": "abc123",
    "status": "active",
    "current_question_index": 2,
    "room_code": "ROOM123",
    ...
  },
  "gameFlow": {
    "id": "flow-1",
    "game_id": "abc123",
    "current_question_id": "q-2",
    "current_question_index": 2,
    "current_question_start_time": "2025-01-25T14:05:00Z",
    "total_questions": 10,
    ...
  }
}
```

**Use Case**: Frontend polling or initial state load

**Error Cases**:

- `404 not_found`: Game doesn't exist
- `404 not_found`: Game flow not found

---

### 6. GET /games/:gameId

**Purpose**: Get basic game details

**Authentication**: Not required

**Request**:

```http
GET /games/abc123
```

**Response** (200):

```json
{
  "id": "abc123",
  "status": "active",
  "room_code": "ROOM123",
  "user_id": "user-id",
  "created_at": "2025-01-25T14:00:00Z",
  ...
}
```

---

### 7. PATCH /games/:gameId/lock

**Purpose**: Lock or unlock the game room to prevent new players from joining

**Authentication**: Required (game owner only)

**Request**:

```http
PATCH /games/abc123/lock
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "locked": true
}
```

**Response** (200):

```json
{
  "id": "abc123",
  "locked": true,
  "status": "waiting",
  ...
}
```

**Error Cases**:

- `400 invalid_payload`: `locked` is not a boolean
- `404 not_found`: Game not found or unauthorized

---

## Testing

### Test Coverage

**File**: `tests/unit/gameStateRoutes.test.ts`  
**Tests**: 14 (all passing)

#### Test Cases

1. **POST /games/:gameId/start**
   - ✅ Should start a game successfully
   - ✅ Should return 404 if game not found
   - ✅ Should return 400 if game is already active

2. **POST /games/:gameId/questions/start**
   - ✅ Should start a question successfully
   - ✅ Should return 400 if questionId is missing

3. **POST /games/:gameId/questions/reveal**
   - ✅ Should trigger answer reveal successfully

4. **PATCH /games/:gameId/status**
   - ✅ Should update game status to paused
   - ✅ Should update game status to completed
   - ✅ Should return 400 if status or action is missing

5. **GET /games/:gameId/state**
   - ✅ Should get game state successfully
   - ✅ Should return 404 if game not found

6. **GET /games/:gameId**
   - ✅ Should get game details successfully

7. **PATCH /games/:gameId/lock**
   - ✅ Should lock game successfully
   - ✅ Should return 400 if locked is not a boolean

### Running Tests

```bash
npx vitest run tests/unit/gameStateRoutes.test.ts
```

---

## Service Layer Updates

### gameFlowService Enhancements

**File**: `src/services/gameFlowService.ts`

#### New Methods

1. **updateGameFlow(gameId, updates)**: Now returns `GameFlowCreateResult`

   ```typescript
   async updateGameFlow(
     gameId: string,
     updates: Partial<GameFlow>
   ): Promise<GameFlowCreateResult>
   ```

2. **getGameFlow(gameId)**: New method for fetching flow with proper error handling
   ```typescript
   async getGameFlow(gameId: string): Promise<GameFlowCreateResult>
   ```

#### Changed Return Types

Previously `updateGameFlow` returned `Promise<boolean>`, now returns structured result:

```typescript
{
  success: boolean;
  gameFlow?: GameFlow;
  error?: string;
}
```

This enables routes to return the updated game flow to the frontend.

---

## Frontend Integration Guide

### Real-time Game Flow Pattern

```typescript
// 1. Start game when host clicks "Start"
const startGame = async (gameId: string) => {
  const response = await fetch(`/games/${gameId}/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const game = await response.json();
  // Emit WebSocket event to notify all participants
  socket.emit('game:started', { gameId, game });
};

// 2. Start each question
const startQuestion = async (gameId: string, question: Question, index: number) => {
  const response = await fetch(`/games/${gameId}/questions/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      questionId: question.id,
      questionIndex: index,
    }),
  });

  const gameFlow = await response.json();
  // Emit WebSocket event to show question to participants
  socket.emit('question:start', { gameId, question, gameFlow });
};

// 3. Reveal answers after time expires
const revealAnswers = async (gameId: string) => {
  const response = await fetch(`/games/${gameId}/questions/reveal`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const result = await response.json();
  // Emit WebSocket event to show correct answers
  socket.emit('answer:reveal', { gameId, ...result });
};

// 4. Pause game
const pauseGame = async (gameId: string) => {
  const response = await fetch(`/games/${gameId}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'pause' }),
  });

  const game = await response.json();
  socket.emit('game:paused', { gameId, game });
};

// 5. End game
const endGame = async (gameId: string) => {
  const response = await fetch(`/games/${gameId}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'end' }),
  });

  const game = await response.json();
  socket.emit('game:ended', { gameId, game });
};

// 6. Poll for game state (if not using WebSocket)
const getGameState = async (gameId: string) => {
  const response = await fetch(`/games/${gameId}/state`);
  return await response.json();
};
```

### Expected WebSocket Events (Frontend → Backend)

After calling these REST endpoints, the frontend should emit corresponding WebSocket events:

| REST Endpoint          | WebSocket Event  | Payload                          |
| ---------------------- | ---------------- | -------------------------------- |
| POST /start            | `game:started`   | `{ gameId, game }`               |
| POST /questions/start  | `question:start` | `{ gameId, question, gameFlow }` |
| POST /questions/reveal | `answer:reveal`  | `{ gameId, gameFlow }`           |
| PATCH /status (pause)  | `game:paused`    | `{ gameId, game }`               |
| PATCH /status (resume) | `game:resumed`   | `{ gameId, game }`               |
| PATCH /status (end)    | `game:ended`     | `{ gameId, game }`               |

---

## Database Schema Integration

### Tables Used

#### games

- `status` (waiting | active | paused | completed)
- `started_at`, `paused_at`, `resumed_at`, `ended_at`
- `current_question_index`
- `locked` (boolean)

#### game_flows

- `current_question_id`
- `current_question_index`
- `current_question_start_time`
- `current_question_end_time`
- `total_questions`

### State Transitions

```
waiting → active (POST /start)
active → paused (PATCH /status action=pause)
paused → active (PATCH /status action=resume)
active → completed (PATCH /status action=end)
```

---

## Security Considerations

### Authentication Requirements

- ✅ **Write Operations**: All require `authMiddleware` and verify `user_id` matches game owner
- ✅ **Read Operations**: Public (GET /state, GET /:gameId) to allow participants to view
- ✅ **Authorization**: Ownership validation via `user_id` check in database query

### Input Validation

- ✅ `questionId` required for question start
- ✅ `status` or `action` required for status updates
- ✅ `locked` must be boolean
- ✅ State transition validation (can only start from `waiting`)

---

## Error Handling

All errors follow the unified error contract:

```json
{
  "error": "error_code",
  "message": "Human-readable message"
}
```

### Common Error Codes

- `not_found`: Game doesn't exist or unauthorized
- `invalid_state`: Invalid state transition
- `invalid_payload`: Missing or invalid request body
- `update_failed`: Database update failed
- `server_error`: Unexpected server error

---

## Performance Considerations

### Optimizations

1. **Minimal Queries**: Single query for ownership validation + update
2. **No Cascading Reads**: Routes don't fetch related data unless needed
3. **Efficient Updates**: Only update changed fields

### Recommended Caching

- **Frontend**: Cache `/state` response for 1-2 seconds during active gameplay
- **WebSocket**: Use WebSocket events instead of polling when possible

---

## Future Enhancements

### Potential Additions

1. **Batch Operations**: Start multiple questions in sequence
2. **Time Extensions**: Allow host to add time to current question
3. **Skip Question**: Allow host to skip a question
4. **Game Settings Update**: Modify settings during gameplay
5. **Participant Controls**: Kick/ban participants

### Monitoring Recommendations

- Track average question duration via `start_time` and `end_time`
- Monitor state transition frequency for anomalies
- Log unauthorized access attempts

---

## Files Modified

### Created

1. `src/routes/game-state.ts` - All game state management routes
2. `tests/unit/gameStateRoutes.test.ts` - Comprehensive test suite

### Modified

1. `src/services/gameFlowService.ts` - Enhanced with proper return types and `getGameFlow` method
2. `src/app.ts` - Registered game-state routes

---

## Integration Checklist

Before deploying to frontend:

- [x] TypeScript compilation passes
- [x] All 14 unit tests pass
- [x] Routes registered in app.ts
- [x] Service methods return proper types
- [x] Error handling follows unified contract
- [x] Authentication middleware applied correctly
- [ ] Frontend implements WebSocket event emissions
- [ ] Frontend implements error handling for all endpoints
- [ ] Real-time state sync tested with multiple clients

---

## Summary

This implementation provides a complete game state management system for controlling quiz flow. The 7 new endpoints enable the frontend to:

1. Start game sessions
2. Orchestrate question flow with timing
3. Trigger answer reveals
4. Control game status (pause/resume/end)
5. Lock rooms to prevent new joins
6. Fetch current game state

All routes are fully tested (14 tests passing) and integrate seamlessly with the existing `gameFlowService`. The frontend can now implement real-time quiz gameplay by calling these endpoints and broadcasting WebSocket events to participants.

**Next Step**: Frontend integration using the provided patterns above.
