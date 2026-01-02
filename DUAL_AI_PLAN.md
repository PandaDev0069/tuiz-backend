# Dual AI Session Coordination Plan

**Date**: December 11, 2025  
**Planning Session**: Joint Strategy

---

## 🎯 Current State Analysis

### Backend Status

- ✅ 3 new route files created (device-sessions, game-flows, websocket-connections)
- ✅ Types defined in `src/types/websocket.ts`
- ✅ Routes registered in `src/app.ts`
- ✅ TypeScript compilation passes
- ❌ **Tests failing** - TypeScript errors in test files

### Frontend Status

- ✅ 4 comprehensive WebSocket hooks created (1,195 lines)
- ✅ Complete REST API service layer (397 lines)
- ✅ Full documentation with usage examples
- ⏳ **Not yet integrated** into existing game screens
- ⏳ SocketProvider needs updates for hook consumption

---

## 🚨 Immediate Issues to Address

### Backend Issues (High Priority)

1. **Test TypeScript Errors**: Test files have compilation errors
   - Missing `email` field in mock user objects
   - `any` type usage needs fixing
   - Answer report validation issues in game player data tests

2. **Test Files to Fix**:
   - `tests/unit/gameFlowRoutes.test.ts`
   - `tests/unit/websocketConnectionRoutes.test.ts`
   - `tests/unit/deviceSessionRoutes.test.ts`
   - `tests/unit/gamePlayerDataService.test.ts`
   - `tests/unit/gameStateRoutes.test.ts`

### Frontend Issues (Medium Priority)

1. **SocketProvider Update**: Needs to export socket instance
2. **Game Context**: Create shared game state provider
3. **Screen Integration**: Connect hooks to existing screens

---

## 📋 Work Split Strategy

### Backend Team Tasks (Priority Order)

**IMMEDIATE (Before Any Other Work)**:

1. **Fix Test TypeScript Errors** (~30 minutes)

   ```typescript
   // Fix: Add email field to mock users
   (req as AuthenticatedRequest).user = {
     id: 'test-user-id',
     email: 'test@example.com',
   };

   // Fix: Replace `any` with specific types
   // Fix: Add answer_report to game player data mocks
   ```

2. **Run Tests & Verify** (~10 minutes)

   ```bash
   npm run typecheck
   npx vitest run tests/unit/gameFlowRoutes.test.ts
   npx vitest run tests/unit/websocketConnectionRoutes.test.ts
   npx vitest run tests/unit/deviceSessionRoutes.test.ts
   ```

3. **Document API Endpoints** (~20 minutes)
   - Update `docs/API.md` with new routes
   - Add request/response examples
   - Document error codes

4. **Socket.io Event Alignment** (~15 minutes)
   - Review frontend event names in `GAME_WEBSOCKET_IMPLEMENTATION.md`
   - Ensure backend WebSocket implementation matches
   - Update `docs/WEBSOCKET_API.md` if needed

**TOTAL ESTIMATED TIME**: ~1.5 hours

---

### Frontend Team Tasks (Priority Order)

**PHASE 1: Foundation Setup** (~30 minutes)

1. **Update SocketProvider**
   - Export socket instance via Context API
   - Create `useSocket()` hook for consumption
   - Maintain backward compatibility

2. **Create Game Context Provider**
   ```typescript
   // src/contexts/GameContext.tsx
   - Wrap game screens with shared state
   - Provide gameId, gameCode, role (host/player)
   - Initialize gameApi with auth token
   ```

**PHASE 2: Screen Integration** (~2 hours) 3. **Host Waiting Room** (`src/app/(pages)/host-waiting-room/page.tsx`)

- Integrate `useGameRoom` for player list
- Add player kick/transfer controls
- Connect game start to `gameApi.startGame()`

4. **Player Join Screen** (`src/app/(pages)/join/page.tsx`)
   - Integrate `useGameRoom.joinRoom()`
   - Add loading states
   - Handle join errors

5. **Host Question Control** (new or existing screen)
   - Integrate `useGameFlow` for question control
   - Add start/end/reveal buttons
   - Display timer and progress

6. **Player Answer Screen** (`src/app/(pages)/player-answer-screen/page.tsx`)
   - Integrate `useGameAnswer` for submission
   - Show timer from `useGameFlow`
   - Handle answer confirmation

**PHASE 3: Leaderboard & Polish** (~1 hour) 7. **Leaderboard Screens** (host + player)

- Integrate `useGameLeaderboard`
- Add score animations
- Show rank changes

8. **Error Handling & Loading States**
   - Add error boundaries
   - Implement reconnection UI
   - Add toast notifications

**TOTAL ESTIMATED TIME**: ~3.5 hours

---

## 🔄 Coordination Checkpoints

### Checkpoint 1: Backend Tests Fixed (Backend Team)

**When**: After fixing all test errors  
**Action**: Update AI_COORDINATION.md with:

```markdown
✅ All tests passing (include test count)
✅ TypeScript compilation clean
✅ Ready for frontend integration
```

### Checkpoint 2: SocketProvider Updated (Frontend Team)

**When**: After creating socket context  
**Action**: Update AI_COORDINATION.md with:

```markdown
✅ SocketProvider exports socket instance
✅ useSocket() hook created
✅ Example usage documented
```

### Checkpoint 3: First Screen Integrated (Frontend Team)

**When**: After completing host waiting room  
**Action**: Test end-to-end flow and report:

```markdown
✅ Screen integrated: host-waiting-room
✅ Socket events working: [list events tested]
✅ API calls successful: [list endpoints tested]
❌ Issues found: [list any problems]
```

### Checkpoint 4: Event Alignment Verified (Backend Team)

**When**: After reviewing frontend event names  
**Action**: Confirm or flag mismatches:

```markdown
✅ All frontend events match backend implementation
OR
⚠️ Mismatches found: [list discrepancies]
```

---

## 🎯 Success Criteria

### Backend Success Metrics

- [ ] All unit tests passing (100%)
- [ ] TypeScript compilation clean (0 errors)
- [ ] API documentation complete
- [ ] Socket.io events documented and aligned

### Frontend Success Metrics

- [ ] At least 2 game screens fully integrated
- [ ] Socket connection stable with reconnection
- [ ] Real-time updates working (player join/leave)
- [ ] Error handling implemented

### Integration Success Metrics

- [ ] End-to-end game flow works (create → join → play → results)
- [ ] Multiple players can join and see updates
- [ ] Host controls work (start game, advance questions)
- [ ] Leaderboard updates in real-time

---

## 📝 Communication Protocol

### For Backend Team

**Update AI_COORDINATION.md after**:

- Fixing test errors (mark task as ✅)
- Running successful test suite (include results)
- Finding any breaking issues (mark as ❌ with details)

**Format**:

```markdown
### Backend Update [TIMESTAMP]

- ✅ Fixed test errors in gameFlowRoutes.test.ts
- ✅ All 45 tests passing
- ⚠️ Found issue: [description]
```

### For Frontend Team

**Update AI_COORDINATION.md after**:

- Completing each screen integration
- Creating new shared components
- Finding Socket.io event issues

**Format**:

```markdown
### Frontend Update [TIMESTAMP]

- ✅ Integrated useGameRoom into host-waiting-room
- ✅ Created GameContext provider
- ⚠️ Socket event 'room:player-joined' not firing
```

---

## 🔧 Quick Reference

### Backend Commands

```bash
# Fix tests & verify
npm run typecheck
npx vitest run

# Check specific test files
npx vitest run tests/unit/gameFlowRoutes.test.ts

# Run all tests
npm test
```

### Frontend Commands

```bash
# Check types
npm run typecheck

# Run dev server
npm run dev

# Run tests
npm test

# Run E2E tests
npm run e2e
```

---

## 🚀 Next Steps

### Backend Team - Start Here

1. Open `tests/unit/gameFlowRoutes.test.ts`
2. Fix mock user objects (add email field)
3. Replace `any` types with specific types
4. Run tests and verify all pass
5. Update coordination file

### Frontend Team - Start Here

1. Create `src/contexts/GameContext.tsx`
2. Update `SocketProvider` to export socket
3. Create `src/hooks/useSocket.ts` wrapper
4. Test socket connection in isolation
5. Update coordination file

---

## 📊 Progress Tracking

### Backend Progress

- [ ] Test errors fixed (5 files)
- [ ] All tests passing
- [ ] API documentation updated
- [ ] Socket events aligned

### Frontend Progress

- [ ] SocketProvider updated
- [ ] GameContext created
- [ ] Host waiting room integrated
- [ ] Player join screen integrated
- [ ] Question control integrated
- [ ] Answer submission integrated
- [ ] Leaderboard integrated
- [ ] Error handling complete

---

## 🎉 Final Goal

**Working real-time quiz game** where:

- Host creates game → gets room code
- Players join with code → appear in waiting room
- Host starts game → all players see first question
- Players submit answers → host sees submission count
- Host reveals answer → all see results + leaderboard
- Game progresses through all questions → final results

**Estimated Total Time**: 5-6 hours (split between both teams)
