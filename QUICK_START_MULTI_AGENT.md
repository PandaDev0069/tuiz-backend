# Quick Start Guide: Multi-Agent Coordination

## 🎯 For All Agents - Start Here

### Step 1: Read These Documents (In Order)

1. `GAME_LOGIC_COMPARISON.md` - Understand what needs to be done (especially user comments)
2. `MULTI_AGENT_COORDINATION.md` - Your task assignments and workflow
3. `AGENT_PROMPTS.md` - Your specific role and responsibilities

### Step 2: Identify Your Role

- **Agent 1**: Backend Game Loop Specialist → Read "PROMPT FOR AGENT 1" in `AGENT_PROMPTS.md`
- **Agent 2**: Frontend Integration Specialist → Read "PROMPT FOR AGENT 2" in `AGENT_PROMPTS.md`
- **Agent 3**: Supervisor/Coordinator → Read "PROMPT FOR AGENT 3" in `AGENT_PROMPTS.md`

### Step 3: Check Current Status

- Open `MULTI_AGENT_COORDINATION.md`
- Check "Current Status" section
- See which tasks are in progress or completed

### Step 4: Announce Your Work

- Before starting any task, update `MULTI_AGENT_COORDINATION.md`
- Mark task as "Started" or "In Progress"
- Add your agent identifier (`@agent1`, `@agent2`, or `@agent3`)

---

## 🚨 Critical Tasks (Priority Order)

### 🔴 BLOCKER - Do First:

1. **Fix Game Loop Repetition** (Agent 1)
   - File: `src/routes/game-state.ts` (POST /games/:gameId/questions/next)
   - Issue: Loop doesn't repeat after one question
   - User Comment: "once a single loop of question and answers is completed the loop is not repeated again"

2. **Complete Leaderboard Integration** (Agent 2 + Agent 1)
   - Backend: Ensure API works, add WebSocket events
   - Frontend: Complete hook, create component, add visualization
   - User Comment: "This is the main thing and it needs careful consideration and implementation" + "good visualization like rank change of top 5 etc"

3. **Implement Explanation Phase** (Agent 1 + Agent 2)
   - Backend: API + WebSocket events
   - Frontend: Component + integration
   - User Comment: "This also needs careful consideration and implementation"

### 🟡 HIGH Priority - Do Next:

4. **Implement Auto-Advance Mode** (Agent 1 + Agent 2)
5. **Fix Answer Statistics Reliability** (Agent 1 + Agent 2)
6. **Compare Scoring Algorithms** (Agent 1)

---

## 📋 Quick Reference

### Agent 1 (Backend) Files:

- `src/routes/game-state.ts`
- `src/routes/game-player-data.ts`
- `src/services/gameFlowService.ts`
- `src/services/gamePlayerDataService.ts`
- `src/services/websocket/WebSocketManager.ts`

### Agent 2 (Frontend) Files:

- `src/hooks/useGameFlow.ts`
- `src/hooks/useGameLeaderboard.ts`
- `src/components/game/*`
- `src/services/gameApi.ts`

### Communication:

- Update `MULTI_AGENT_COORDINATION.md` for status
- Use `@agent1`, `@agent2`, `@agent3` comments in code
- Report blockers immediately

---

## ✅ Success Checklist

After completing all tasks, verify:

- [ ] Game loop repeats correctly for all questions
- [ ] Leaderboard displays between questions (with rank animations)
- [ ] Explanation displays after leaderboard
- [ ] Auto-advance mode works
- [ ] Manual mode still works
- [ ] Answer statistics are reliable
- [ ] Scoring calculates correctly
- [ ] No console errors
- [ ] No API errors
- [ ] Complete integration works

---

## 🆘 Need Help?

- **Conflict with another agent?** → Check `MULTI_AGENT_COORDINATION.md` → Contact Agent 3 (Supervisor)
- **Unclear requirements?** → Re-read user comments in `GAME_LOGIC_COMPARISON.md`
- **Code pattern questions?** → Review existing codebase patterns
- **Integration issues?** → Contact Agent 3 (Supervisor) for testing

---

_Start with Phase 1: Fix Game Loop Repetition (Agent 1)_
