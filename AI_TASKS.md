# AI Tasks - Work Assignment

**Last Updated**: 2025-12-11 16:50 JST

---

## 🔴 HIGH PRIORITY

### Task 1: Backend Test Lint Fixes

**Status**: ⏳ AVAILABLE  
**Owner**: Any AI  
**Effort**: 30-45 minutes

**Files**:

- `tests/unit/gameFlowRoutes.test.ts`
- `tests/unit/websocketConnectionRoutes.test.ts`
- `tests/unit/deviceSessionRoutes.test.ts`

**Issue**: ESLint warnings about `any` types

**Action**:

```bash
cd tuiz-backend/
npm run lint -- --fix
npm run typecheck
```

---

### Task 2: Frontend Game Hooks ⭐ IN PROGRESS

**Status**: 🔄 AI Session 2  
**Owner**: Frontend AI  
**Effort**: 2-3 hours

**Sub-tasks**:

- ✅ 2.1: useGameRoom (332 lines) - Commit 93093e1
- 🔄 2.2: useGameFlow (~200-250 lines) - IN PROGRESS
- ⏳ 2.3: useGameAnswer (~150-200 lines)
- ⏳ 2.4: useGameLeaderboard (~150-200 lines)

**Dependencies**: ✅ All met

---

### Task 3: Screen Integration

**Status**: ❌ BLOCKED (waiting for Task 2)  
**Owner**: Frontend AI  
**Effort**: 2-3 hours

**Screens**:

1. Host waiting room - useGameRoom
2. Host question control - useGameFlow
3. Player join - useGameRoom
4. Player answer - useGameAnswer
5. Leaderboard - useGameLeaderboard

---

## 🟡 MEDIUM PRIORITY

### Task 4: API Documentation

**Status**: ⏳ AVAILABLE  
**Owner**: Any AI  
**Effort**: 30-45 minutes

**Files**: `docs/API.md`  
**Action**: Add WebSocket endpoint documentation

---

## 🟢 LOW PRIORITY

### Task 5: E2E Testing

**Status**: ⏳ PENDING  
**Owner**: Any AI  
**Effort**: 1-2 hours

**Scenarios**: Full game flow, reconnection, errors

---

## 📋 Task Assignment Rules

1. Check `AI_STATUS.md` for current work
2. Pick task marked ⏳ AVAILABLE
3. Update status to 🔄 IN PROGRESS
4. Post message in `AI_MESSAGES.md`
5. Update every 30-60 minutes
