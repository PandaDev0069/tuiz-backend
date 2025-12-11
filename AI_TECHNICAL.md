# AI Technical Reference

**Last Updated**: 2025-12-11 16:50 JST

---

## 🔗 Socket.io Events (MUST MATCH)

### Backend Events (DO NOT CHANGE)

```typescript
// Connection
'ws:connect' | 'ws:connected' | 'ws:disconnect';

// Room management
'room:join' | 'room:joined' | 'room:leave' | 'room:left';
'room:message' | 'room:user-joined' | 'room:user-left';

// Game actions
'game:action' | 'game:state';
```

### Frontend Events (Implement in hooks)

```typescript
// useGameRoom
'game:player-joined' | 'game:player-left';
'game:room-locked' | 'game:room-unlocked';

// useGameFlow
'game:question-start' | 'game:question-end';
'game:reveal-answer' | 'game:next-question';
'game:pause' | 'game:resume';

// useGameAnswer
'player:answer-submit' | 'player:answer-confirmed';
('player:answer-result');

// useGameLeaderboard
'game:scores-update' | 'game:final-results';
('game:rank-change');
```

---

## 📁 Key Files

### Backend (tuiz-backend/)

```
src/routes/
  - game-flows.ts ✅
  - websocket-connections.ts ✅
  - device-sessions.ts ✅

src/types/
  - websocket.ts ✅
```

### Frontend (tuiz-frontend/)

```
src/services/
  - gameApi.ts ✅ (397 lines)

src/contexts/
  - GameContext.tsx ✅ (127 lines)

src/hooks/
  - useGameRoom.ts ✅ (332 lines)
  - useGameFlow.ts 🔄 IN PROGRESS
  - useGameAnswer.ts ⏳
  - useGameLeaderboard.ts ⏳
```

---

## 🚀 Quality Checks

### Before Committing

```bash
# Frontend
cd tuiz-frontend/
npm run typecheck
npm run lint
npm test

# Backend
cd tuiz-backend/
npm run typecheck
npm run lint
npm test
```

---

## 🎯 Integration Pattern

**All hooks follow this pattern**:

1. Wrap `useWebSocket()` for connection
2. Add game-specific event listeners
3. Integrate with `gameApi` for REST
4. Work with `GameContext` for state
5. Provide clean API for screens

**Example**:

```typescript
const { room, players, joinRoom } = useGameRoom({
  onPlayerJoined: (player) => console.log(player),
  onError: (error) => console.error(error),
});
```
