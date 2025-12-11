# AI Agent Onboarding Manual

**Welcome to the TUIZ Dual-AI Development Team!**

This manual will get you productive in **under 5 minutes**.

---

## 🎯 Your Mission

You're part of a **2-AI coordinated development team** building a real-time multiplayer quiz platform. We work in parallel on independent tasks while staying synchronized through simple status files.

**Your job**: Pick up available tasks, complete them, update status files, and move to the next task.

---

## ⚡ Quick Start (60 seconds)

### Step 1: Read Current Status (30 sec)
```bash
# Open this file first
AI_STATUS.md
```

This tells you:
- Who's working on what RIGHT NOW
- What tasks are available for you
- Current project progress

### Step 2: Check Available Tasks (30 sec)
```bash
# Then read this
AI_TASKS.md
```

Look for tasks marked: ⏳ **AVAILABLE**

### Step 3: Start Working
1. Update `AI_STATUS.md` - change task to 🔄 **IN PROGRESS** 
2. Post in `AI_MESSAGES.md` - announce what you're doing
3. Start coding!

---

## 📁 File Structure (What's What)

### Coordination Files (tuiz-backend/)

| File | Purpose | When to Read | Update Frequency |
|------|---------|--------------|------------------|
| `AI_STATUS.md` | Current work snapshot | Before starting | Every task change |
| `AI_TASKS.md` | Task assignments | When picking task | When completing |
| `AI_MESSAGES.md` | Inter-AI communication | Every 30-60 min | Every 30-60 min |
| `AI_TECHNICAL.md` | Code patterns & specs | When coding | Rarely |

### Code Repositories

**Backend** (`tuiz-backend/`):
- Express.js + TypeScript + Socket.io
- REST API routes in `src/routes/`
- WebSocket logic in `src/services/`
- Tests in `tests/`

**Frontend** (`tuiz-frontend/`):
- Next.js 15 + React 19 + TypeScript
- Pages in `src/app/(pages)/`
- Hooks in `src/hooks/`
- Services in `src/services/`

---

## 🎓 How to Work (Step by Step)

### Before Starting Any Task

1. **Read `AI_STATUS.md`** - See what other AI is doing
2. **Check `AI_TASKS.md`** - Find task marked ⏳ AVAILABLE
3. **Avoid conflicts** - Don't pick 🔄 IN PROGRESS tasks

### When Starting a Task

**Update `AI_STATUS.md`**:
```markdown
### AI Session [Your #] - ACTIVE

**Status**: 🔄 IN PROGRESS
**Task**: [Task name from AI_TASKS.md]
**ETA**: [Estimated time]
```

**Post in `AI_MESSAGES.md`**:
```markdown
### Message #[next number] - AI Session [Your #] (HH:MM JST)

**Starting**: [Task name]
**ETA**: [Time estimate]
**Files to modify**: [List them]
**Available for other AI**: [Other independent tasks]
```

### While Working (Every 30-60 min)

**Add progress update to `AI_MESSAGES.md`**:
```markdown
**Progress Update**: 
- ✅ Completed: [What's done]
- 🔄 Working on: [Current work]
- ⏳ Next: [What's next]
```

### After Completing a Task

1. **Run quality checks**:
```bash
npm run typecheck
npm run lint
npm test
```

2. **Commit changes**:
```bash
git add [files]
git commit -m "type(scope): description"
```

3. **Update `AI_STATUS.md`**:
```markdown
**Status**: ⏳ AVAILABLE
**Last completed**: [Task name] - Commit [hash]
```

4. **Update `AI_TASKS.md`**:
Change task status from 🔄 to ✅

5. **Post completion in `AI_MESSAGES.md`**:
```markdown
### Message #[number] - TASK COMPLETE

**Completed**: [Task name]
**Commit**: [git hash]
**Files**: [List modified files]
**What's next**: [Next available tasks]
```

---

## 🚨 Critical Rules

### DO:
✅ **Read status files before starting**  
✅ **Update status every 30-60 minutes**  
✅ **Run typecheck before committing**  
✅ **Post when starting/finishing tasks**  
✅ **Work on AVAILABLE tasks only**  
✅ **Be specific in commit messages**

### DON'T:
❌ **Start work without checking status**  
❌ **Work on IN PROGRESS tasks**  
❌ **Commit without quality checks**  
❌ **Modify files other AI is editing**  
❌ **Skip status updates**  
❌ **Commit broken code**

---

## 💡 Common Scenarios

### Scenario 1: You're the First AI Today

1. Read `AI_STATUS.md` to see project state
2. Pick highest priority AVAILABLE task from `AI_TASKS.md`
3. Update status and start working
4. Post regular updates every 30-60 min

### Scenario 2: Another AI is Already Working

1. Read their status in `AI_STATUS.md`
2. Read their last message in `AI_MESSAGES.md`
3. Pick a **different** AVAILABLE task
4. Announce your task so they know
5. Work independently in parallel

### Scenario 3: No Tasks Match Your Skills

1. Post in `AI_MESSAGES.md` asking for guidance
2. Read `AI_TASKS.md` descriptions carefully
3. Pick the closest match and learn as you go
4. Update documentation if you improve a task description

### Scenario 4: You're Blocked

1. **Immediately** update `AI_STATUS.md` with ❌ BLOCKED status
2. Post in `AI_MESSAGES.md` with:
   - What blocked you
   - What you need to proceed
   - Alternative tasks you can do
3. Switch to another AVAILABLE task
4. Check back in 30-60 min

### Scenario 5: You Finish Early

1. Complete all task steps (tests, commit, updates)
2. Read `AI_TASKS.md` for next priority task
3. If no tasks available, improve documentation
4. Post completion message

---

## 🔧 Technical Quick Reference

### Quality Check Commands

**Frontend**:
```bash
cd tuiz-frontend/
npm run typecheck    # Must pass
npm run lint         # Must pass
npm test             # Should pass
```

**Backend**:
```bash
cd tuiz-backend/
npm run typecheck    # Must pass
npm run lint         # Must pass (or --no-verify if docs only)
npm test             # 95%+ should pass
```

### Git Workflow

```bash
# Before starting
git pull origin [branch]
git status

# During work
git add [files]
git commit -m "type(scope): description"

# If lint fails on commit
git commit --no-verify -m "..."  # Only for docs!

# After completing
git push origin [branch]
```

### Commit Message Format

```
type(scope): description

- type: feat, fix, docs, test, refactor, chore
- scope: frontend, backend, hooks, api, tests
- description: what changed (imperative mood)
```

**Examples**:
- `feat(frontend): create useGameFlow hook for question control`
- `fix(backend): resolve TypeScript errors in game routes`
- `docs(coordination): update AI status with current tasks`
- `test(backend): add unit tests for WebSocket routes`

---

## 📊 Understanding Task Priorities

### 🔴 HIGH PRIORITY - Critical Path
**Do these first**. They block other work.

Example: Frontend hooks block screen integration.

### 🟡 MEDIUM PRIORITY - Important but not blocking
**Do after HIGH**. Improve quality but don't block progress.

Example: API documentation, code cleanup.

### 🟢 LOW PRIORITY - Nice to have
**Do when nothing else available**. Polish and optimization.

Example: E2E tests, performance tuning.

---

## 🎯 Current Project Context

### What We're Building
**TUIZ** - Real-time multiplayer quiz platform (Japanese-first UI)

**Tech Stack**:
- **Backend**: Express.js + Socket.io + Supabase + TypeScript
- **Frontend**: Next.js 15 + React 19 + Socket.io-client + TypeScript
- **Database**: PostgreSQL via Supabase
- **Real-time**: Socket.io for bidirectional WebSocket events

### Architecture Pattern

**Game Flow**:
1. Host creates game via REST API → Gets room code
2. Players join via REST API + WebSocket
3. Real-time updates via Socket.io events
4. Game progression: Questions → Answers → Leaderboard
5. Final results stored in database

**Code Pattern** (Frontend hooks):
```typescript
// All hooks follow this pattern
export function useGameX() {
  // 1. Wrap useWebSocket for connection
  const ws = useWebSocket(cfg.apiBase, { /* events */ });
  
  // 2. Use gameApi for REST operations
  const { data, error } = await gameApi.someOperation();
  
  // 3. Listen to Socket.io events
  ws.on('game:event', (data) => { /* handle */ });
  
  // 4. Provide clean API
  return { state, actions };
}
```

### Current Progress (Check AI_STATUS.md for latest)

**Backend**: ~95% complete
- ✅ REST API routes
- ✅ WebSocket routes
- ✅ Database migrations
- ⚠️ Test lint fixes pending

**Frontend**: ~50% complete
- ✅ API client (gameApi.ts)
- ✅ Context providers
- 🔄 Game hooks (1 of 4 done)
- ⏳ Screen integration

---

## 📚 Key Files to Know

### Must Read Before Coding

| File | Why Important |
|------|---------------|
| `AI_TECHNICAL.md` | Socket.io event names (MUST MATCH!) |
| `.github/copilot-instructions.md` | Project standards |
| `docs/ARCHITECTURE.md` | System design |

### Common Edit Locations

**Backend**:
- `src/routes/*.ts` - REST endpoints
- `src/services/*.ts` - Business logic
- `tests/unit/*.test.ts` - Unit tests

**Frontend**:
- `src/hooks/*.ts` - React hooks
- `src/services/*.ts` - API clients
- `src/app/(pages)/*/page.tsx` - UI screens

### Never Edit Without Coordination

⚠️ **Announce in `AI_MESSAGES.md` before touching**:
- `src/app.ts` (backend route registration)
- `src/types/*` (shared type definitions)
- Database migration files
- `package.json` (dependencies)

---

## 🆘 Troubleshooting

### TypeScript Errors
```bash
npm run typecheck
# Read errors carefully
# Fix types, don't use 'any'
# Check imports are correct
```

### ESLint Errors
```bash
npm run lint
# Follow suggested fixes
# Don't disable rules
# Use --no-verify only for docs commits
```

### Test Failures
```bash
npm test
# Read error messages
# Check if backend is running
# Verify database is seeded
# Look for similar passing tests
```

### Git Conflicts
```bash
git status
# If conflicts, read both versions
# Keep both AI's changes if possible
# Test after resolving
# Update AI_MESSAGES.md about resolution
```

### Can't Find Task Details
1. Task overview: `AI_TASKS.md`
2. Technical specs: `AI_TECHNICAL.md`
3. Past messages: `AI_MESSAGES.md`
4. Full archive: `AI_COORDINATION_ARCHIVE.md`

---

## 🎓 Learning Resources

### Understanding the Codebase

**If you're new to**:
- Next.js → Read `docs/FRONTEND-STANDARDS.md`
- Socket.io → Read `docs/WEBSOCKET_API.md`
- Testing → Read `docs/TESTING.md`
- Backend → Read `docs/BACKEND-STANDARDS.md`

### Best Practices

**From experienced AI sessions**:
- ✅ Read existing similar files before creating new ones
- ✅ Follow established patterns (don't reinvent)
- ✅ Test incrementally (don't wait until end)
- ✅ Update docs as you learn
- ✅ Ask questions in `AI_MESSAGES.md`

---

## 🚀 Your First Task (Recommended)

### If You're Completely New

**Start with**: Task 4 (API Documentation) or Task 1 (Test Cleanup)

**Why**: 
- Low risk of conflicts
- Helps you learn the codebase
- Provides value immediately
- Easy to verify success

### If You're Comfortable

**Start with**: Whatever is highest priority in `AI_TASKS.md`

---

## 📞 Getting Help

### If Something is Unclear

1. **Check files in this order**:
   - `AI_STATUS.md` - Current state
   - `AI_TASKS.md` - Task details
   - `AI_TECHNICAL.md` - Code specs
   - `AI_MESSAGES.md` - Recent discussions

2. **Still confused?**
   - Post question in `AI_MESSAGES.md`
   - Continue with different task
   - Check back in 30-60 min

3. **Documentation gaps?**
   - Add clarification to appropriate doc
   - Update AI_TASKS.md with better description
   - Help future AIs!

---

## ✅ Checklist: Am I Ready?

Before you start coding, confirm:

- [ ] I've read `AI_STATUS.md`
- [ ] I know what other AI is doing
- [ ] I've picked an AVAILABLE task
- [ ] I've updated status to IN PROGRESS
- [ ] I've posted start message
- [ ] I know quality check commands
- [ ] I know how often to update (30-60 min)
- [ ] I know where to commit code

---

## 🎯 Success Metrics

**You're doing great if**:
- ✅ Other AI knows what you're working on
- ✅ No merge conflicts
- ✅ TypeScript compilation passes
- ✅ Tasks get completed
- ✅ Status files stay updated
- ✅ Code quality improves

**Red flags**:
- ❌ Working >1 hour without status update
- ❌ Committing without running typecheck
- ❌ Starting work other AI is doing
- ❌ Breaking existing tests
- ❌ Not posting when blocked

---

## 🎉 Final Words

**Remember**:
- We're a **team** - coordination is key
- **Communication** via status files is critical
- **Quality** over speed - run all checks
- **Learning** is encouraged - update docs
- **Parallel work** is the goal - stay independent

**You've got this!** Start with `AI_STATUS.md` and pick your first task.

---

**Questions?** Post in `AI_MESSAGES.md`  
**Ready?** Read `AI_STATUS.md` now!  
**Good luck!** 🚀
