# Multi-Agent Coordination Plan: TUIZ_V2 Game Logic Completion

## Overview

This document defines the roles and coordination strategy for 3 AI agents working together to complete the game logic for TUIZ_V2. The agents will work in parallel while coordinating through this document and code comments.

**Goal**: Complete the core game loop with leaderboard, explanation, and auto-advance features.

---

## Agent Roles

### 🎯 Agent 1: Backend Game Loop Specialist

**Focus**: Backend game flow, API endpoints, game state management, WebSocket events

### 🎨 Agent 2: Frontend Integration Specialist

**Focus**: Frontend components, hooks, UI integration, real-time updates

### 👨‍💼 Agent 3: Supervisor/Coordinator (Primary Agent)

**Focus**: Coordination, code review, integration testing, conflict resolution

---

## Critical Tasks (From User Comments)

### 🔴 BLOCKER Priority:

1. **Fix Game Loop Repetition** - Loop doesn't repeat after one question
2. **Complete Leaderboard Integration** - Backend ready, frontend incomplete
3. **Implement Explanation Phase** - Data exists, no implementation

### 🟡 HIGH Priority:

4. **Implement Auto-Advance Mode** - Only manual mode exists
5. **Fix Answer Statistics Reliability** - Partially implemented, unreliable
6. **Compare Scoring Algorithms** - Decide which is better

---

## Task Distribution

### Agent 1 (Backend) Responsibilities:

- Fix `POST /games/:gameId/questions/next` endpoint (game loop repetition)
- Implement explanation phase backend (API + WebSocket events)
- Implement auto-advance logic in backend
- Fix answer statistics reliability
- Compare and update scoring algorithm if needed
- Add game settings to `play_settings` (autoAdvance, showExplanations, etc.)

### Agent 2 (Frontend) Responsibilities:

- Complete leaderboard frontend integration
- Implement explanation display component
- Implement auto-advance UI and logic
- Fix answer statistics display reliability
- Add leaderboard visualization (rank changes, top 5, etc.)
- Integrate all phases into game flow

### Agent 3 (Supervisor) Responsibilities:

- Review all code changes
- Resolve conflicts between agents
- Ensure integration between backend and frontend
- Test complete game loop end-to-end
- Update documentation
- Coordinate communication between agents

---

## Communication Protocol

1. **Before Starting Work**:
   - Agent announces which task they're starting
   - Check for conflicts with other agents
   - Update task status in this document

2. **During Work**:
   - Add detailed comments explaining changes
   - Use TODO comments for incomplete work
   - Mark files you're working on with `@agent1` or `@agent2` comments

3. **After Completing Work**:
   - Update task status
   - Document what was changed
   - Notify supervisor for review

4. **Conflict Resolution**:
   - If two agents need same file, supervisor assigns priority
   - Backend changes take precedence over frontend if API changes
   - Frontend changes take precedence if UI-only

---

## File Ownership Guidelines

### Agent 1 (Backend) Owns:

- `src/routes/game-state.ts`
- `src/routes/game-player-data.ts`
- `src/services/gameFlowService.ts`
- `src/services/gamePlayerDataService.ts`
- `src/services/gameEventService.ts`
- `src/services/websocket/WebSocketManager.ts`
- `src/types/game.ts`
- `src/types/gamePlayerData.ts`

### Agent 2 (Frontend) Owns:

- `src/hooks/useGameFlow.ts`
- `src/hooks/useGameLeaderboard.ts`
- `src/hooks/useGameAnswer.ts`
- `src/contexts/GameContext.tsx`
- `src/components/game/*` (all game components)
- `src/services/gameApi.ts`

### Shared (Requires Coordination):

- `GAME_LOGIC_COMPARISON.md` - All agents can read, supervisor updates
- `MULTI_AGENT_COORDINATION.md` - Supervisor manages
- Database migrations - Agent 1 creates, supervisor reviews
- WebSocket event definitions - Agent 1 defines, Agent 2 consumes

---

## Workflow Phases

### Phase 1: Fix Game Loop (Agent 1)

**Goal**: Fix the bug where game loop doesn't repeat

**Tasks**:

1. Investigate `POST /games/:gameId/questions/next` endpoint
2. Check `gameFlowService.updateGameFlow` logic
3. Ensure proper question index advancement
4. Test loop repetition
5. Fix any bugs found

**Deliverable**: Working game loop that repeats correctly

---

### Phase 2: Leaderboard Integration (Agent 2 + Agent 1)

**Goal**: Complete leaderboard display in game flow

**Agent 1 Tasks**:

1. Ensure leaderboard API is working correctly
2. Add WebSocket events for leaderboard updates
3. Add leaderboard phase to game flow

**Agent 2 Tasks**:

1. Complete `useGameLeaderboard` hook
2. Create leaderboard display component
3. Add rank change animations (top 5)
4. Integrate into game flow (after answer reveal, before explanation)
5. Add final leaderboard at game end

**Deliverable**: Fully integrated leaderboard with visualization

---

### Phase 3: Explanation Phase (Agent 1 + Agent 2)

**Goal**: Implement explanation display phase

**Agent 1 Tasks**:

1. Create explanation API endpoint (or add to existing)
2. Add WebSocket events: `game:explanation:show`, `game:explanation:hide`
3. Integrate explanation timing logic
4. Add explanation to game flow (after leaderboard)

**Agent 2 Tasks**:

1. Create explanation display component
2. Add explanation hook or extend `useGameFlow`
3. Integrate into game flow
4. Handle `show_explanation_time` timing

**Deliverable**: Working explanation phase with timing

---

### Phase 4: Auto-Advance Mode (Agent 1 + Agent 2)

**Goal**: Implement auto-advance functionality

**Agent 1 Tasks**:

1. Add `autoAdvance` to `play_settings` schema (migration if needed)
2. Implement auto-advance logic in backend
3. Add phase transition automation
4. Handle auto-advance timing

**Agent 2 Tasks**:

1. Add auto-advance toggle in UI
2. Implement auto-advance client-side logic
3. Handle phase transitions automatically
4. Allow host override

**Deliverable**: Working auto-advance mode

---

### Phase 5: Fix Answer Statistics (Agent 1 + Agent 2)

**Goal**: Make answer statistics reliable

**Agent 1 Tasks**:

1. Review answer statistics calculation
2. Fix any reliability issues
3. Ensure real-time updates work correctly
4. Test edge cases

**Agent 2 Tasks**:

1. Verify frontend display
2. Fix any display issues
3. Test real-time updates
4. Ensure statistics show correctly

**Deliverable**: Reliable answer statistics

---

### Phase 6: Scoring Algorithm (Agent 1)

**Goal**: Compare and decide on scoring algorithm

**Agent 1 Tasks**:

1. Compare old (logarithmic) vs new (linear) algorithms
2. Test both algorithms
3. Document pros/cons
4. Implement chosen algorithm or hybrid
5. Update documentation

**Deliverable**: Finalized scoring algorithm

---

## Success Criteria

### Game Loop Must:

- ✅ Repeat correctly for all questions
- ✅ Include all phases: Question → Answer → Reveal → Leaderboard → Explanation → Next
- ✅ Handle last question correctly (no leaderboard, show explanation, end game)
- ✅ Support both manual and auto-advance modes

### Leaderboard Must:

- ✅ Display between questions (if not last)
- ✅ Show rank changes with animations
- ✅ Update in real-time
- ✅ Display final leaderboard at game end

### Explanation Must:

- ✅ Display after answer reveal
- ✅ Respect `show_explanation_time` setting
- ✅ Show title, text, and image if available
- ✅ Auto-advance if enabled

### Auto-Advance Must:

- ✅ Progress through all phases automatically
- ✅ Allow host override at any time
- ✅ Respect game settings

---

## Testing Checklist

After each phase, test:

- [ ] Game loop repeats correctly
- [ ] All phases display in correct order
- [ ] Leaderboard shows between questions
- [ ] Explanation shows after leaderboard
- [ ] Auto-advance works correctly
- [ ] Manual mode still works
- [ ] Answer statistics update correctly
- [ ] Scoring calculates correctly
- [ ] WebSocket events fire correctly
- [ ] No console errors
- [ ] No API errors

---

## Current Status

### Phase 1: Fix Game Loop

- [x] Started
- [x] In Progress
- [x] Completed
- [ ] Tested

**Status**:

- Frontend: Fixed `nextQuestion` function in `useGameFlow.ts` hook to properly call the API endpoint
- Backend: Enhanced `POST /games/:gameId/questions/next` with defensive validation, bounds checking, and improved error handling
- Both frontend and backend are complete and ready for testing

**Agent 1 Updates**: Enhanced game loop logic with better validation and error handling:

- Added defensive checks for question index bounds (prevents runtime errors)
- Moved "no more questions" check earlier to prevent array access errors
- Improved error messages and logging
- Better game completion handling

**Supervisor Review**: ✅ **APPROVED** - See `SUPERVISOR_REVIEW_AGENT1.md` for detailed review

### Phase 2: Leaderboard Integration

- [x] Started
- [x] In Progress (Backend)
- [x] Completed (Backend)
- [ ] In Progress (Frontend)
- [ ] Completed (Frontend)
- [ ] Tested

**Status**:

- Backend: Added `game:leaderboard:update` WebSocket event broadcast when answers are revealed
- Frontend: `useGameLeaderboard` hook exists and listens for updates, but visualization component needs to be created

**Agent 1 Updates**: Enhanced leaderboard WebSocket support:

- Updated reveal endpoint to include full leaderboard data in `game:leaderboard:update` event
- Updated WebSocket types to support full leaderboard structure with player details
- Added fallback handling if leaderboard fetch fails
- Proper error handling with graceful degradation

**Supervisor Review**: ✅ **APPROVED** - Implementation includes proper fallback mechanisms

### Phase 3: Explanation Phase

- [x] Started
- [x] In Progress (Backend)
- [x] Completed (Backend)
- [x] In Progress (Frontend)
- [x] Completed (Frontend)
- [ ] Tested

**Status**:

- Backend: Added `POST /games/:gameId/questions/explanation/show` and `POST /games/:gameId/questions/explanation/hide` endpoints
- Backend: Added `GET /games/:gameId/questions/:questionId/explanation` endpoint
- Backend: Added `game:explanation:show` and `game:explanation:hide` WebSocket events
- Backend: Updated WebSocket types to include explanation events
- Frontend: `HostExplanationScreen` component created
- ✅ **FIXED**: Frontend `gameApi.ts` now has all explanation API methods (`showExplanation`, `hideExplanation`, `getExplanation`)
- ✅ **FIXED**: Data transformation utility created (`explanationUtils.ts`)
- ✅ **COMPLETED**: WebSocket event listeners for explanation events added to `useGameFlow.ts`
- ✅ **COMPLETED**: Integration into game flow state management

**Agent 2 Updates**: Resolved critical blocking issues and completed integration:

- Added all three explanation API methods to `gameApi.ts`
- Created `explanationUtils.ts` with transformation functions
- Properly maps backend format to frontend `ExplanationData` format
- Added WebSocket event listeners for `game:explanation:show` and `game:explanation:hide` in `useGameFlow.ts`
- Integrated explanation events into game flow state management with proper callbacks

**Supervisor Review**: ✅ **FULLY APPROVED** - See `SUPERVISOR_REVIEW_AGENT2.md` for detailed review

**Agent 1 Updates**: Explanation phase backend is complete:

- Verified existing `GET /games/:gameId/questions/:questionId/explanation` endpoint
- Verified existing `POST /games/:gameId/questions/explanation/show` and `hide` endpoints
- WebSocket events (`game:explanation:show`, `game:explanation:hide`) are implemented and working
- All explanation endpoints are functional and ready for frontend integration

**Supervisor Review**: ✅ **APPROVED** - All endpoints verified and working correctly

**Update**: Agent 1 addressed minor consistency issue - added default value for `show_explanation_time` in POST endpoint to match GET endpoint (both now default to 10 seconds).

### Phase 4: Auto-Advance Mode

- [ ] Started
- [ ] In Progress
- [ ] Completed
- [ ] Tested

### Phase 5: Fix Answer Statistics

- [ ] Started
- [ ] In Progress
- [ ] Completed
- [ ] Tested

### Phase 6: Scoring Algorithm

- [ ] Started
- [ ] In Progress
- [ ] Completed
- [ ] Tested

---

## 🚨 Critical Issues (Supervisor Review)

### Issue 1: Missing Frontend API Methods 🔴

**Status**: **CRITICAL BLOCKER**

**Problem**: Frontend `gameApi.ts` is missing explanation API methods:

- `showExplanation(gameId: string)`
- `hideExplanation(gameId: string)`
- `getExplanation(gameId: string, questionId: string)`

**Action Required**: Agent 2 must add these methods to `tuiz-frontend/src/services/gameApi.ts` in the "QUESTION CONTROL" section (after `nextQuestion` method).

**See**: `SUPERVISOR_REVIEW.md` for detailed implementation guide.

### Issue 2: Data Format Mismatch ⚠️

**Status**: **MEDIUM PRIORITY**

**Problem**: Backend explanation response uses different field names than frontend `ExplanationData` interface:

- Backend: `text`, `image_url`, `show_time`
- Frontend expects: `body`, `image`, `timeLimit`
- Also missing: `questionNumber`, `totalQuestions` in backend response

**Action Required**: Agent 2 needs to create data transformation utility.

**See**: `SUPERVISOR_REVIEW.md` for details and recommendations.

---

## Notes for Agents

- Always check `GAME_LOGIC_COMPARISON.md` for context
- Read user comments in the comparison document carefully
- Follow existing code patterns and TypeScript conventions
- Write clear, documented code
- Test your changes before marking complete
- Communicate conflicts immediately
- Update this document with progress
- **Check `SUPERVISOR_REVIEW.md` for detailed code review and action items**

---

_Last Updated: [Date]_
_Supervisor: Agent 3_
_Backend Specialist: Agent 1_
_Frontend Specialist: Agent 2_
