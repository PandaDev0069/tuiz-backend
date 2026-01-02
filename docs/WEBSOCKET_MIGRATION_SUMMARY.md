# WebSocket System Migration Summary

## Migration File Created

- **File**: `20251124000000_create_websocket_system.sql`
- **Purpose**: Implement database persistence for WebSocket connections, device sessions, and game event logging
- **Status**: Ready to apply

## Database Schema Analysis

### Existing Tables (from game system)

The existing game system already provides foundational tables:

1. **`games`** - Game session lifecycle and settings
2. **`players`** - Player identity with device_id support
3. **`game_flows`** - Current question state tracking
4. **`game_player_data`** - Player scores and analytics

### New Tables Added

#### 1. `websocket_connections`

**Purpose**: Track WebSocket connection lifecycle for audit and analytics

**Key Features**:

- Tracks active and disconnected connections
- Records reconnection counts per device
- Stores IP address and user agent for security
- Supports connection metadata (browser info, etc.)
- Automatic heartbeat tracking

**Use Cases**:

- Monitor active connections in real-time
- Audit connection history
- Detect suspicious connection patterns
- Analytics on connection quality

**Indexes**:

- Fast device lookup: `device_id`
- User connection history: `user_id`
- Active connection filtering: `status`
- Time-based queries: `connected_at`
- Socket ID lookup: `socket_id`

#### 2. `device_sessions`

**Purpose**: Aggregate device usage history and link devices to users

**Key Features**:

- Unique device tracking across all connections
- Total connection and reconnection counts
- Browser fingerprinting support
- First seen/last seen timestamps
- User linking for authenticated sessions

**Use Cases**:

- Device-to-user mapping
- Usage pattern analysis
- Account recovery via device history
- Multi-device detection per user

**Indexes**:

- Unique device constraint: `device_id`
- User's devices lookup: `user_id`
- Active device tracking: `last_seen`

#### 3. `game_events`

**Purpose**: Log all game actions for replay, analytics, and debugging

**Key Features**:

- Sequential event ordering per game
- Event type categorization
- Rich payload support (JSONB)
- Socket, device, player, and user tracking
- Timestamp precision for analytics

**Use Cases**:

- Game replay functionality
- Cheat detection and validation
- Player behavior analytics
- Debug game flow issues
- Performance metrics

**Indexes**:

- Game event history: `game_id`
- Time-based analysis: `timestamp`
- Event type filtering: `event_type`
- Player action tracking: `player_id`
- Ordered replay: `game_id + sequence_number`

#### 4. `room_participants`

**Purpose**: Enhanced room membership tracking (complements `players` table)

**Key Features**:

- Detailed connection history per participant
- Role-based access (host, player, spectator)
- Join/leave timestamps
- Connection status tracking
- Participant metadata storage

**Use Cases**:

- Track participant connection quality
- Handle reconnections to same room
- Role-based game permissions
- Connection history per room

**Indexes**:

- Room member lookup: `game_id`
- Participant history: `device_id`, `player_id`
- Socket tracking: `socket_id`
- Active participant filtering: `status`

## Helper Functions (12 Total)

### Connection Management

1. **`get_device_reconnect_count(device_id)`** - Count reconnections for a device
2. **`get_active_connections_count()`** - Get total active connection count
3. **`update_device_session(device_id, user_id, ...)`** - Upsert device session on connect
4. **`record_reconnection(device_id)`** - Increment reconnection counter

### Game Event Logging

5. **`log_game_event(game_id, event_type, action, ...)`** - Log event with auto-sequence
6. **`get_game_event_sequence(game_id)`** - Retrieve ordered event sequence for replay

### Analytics

7. **`get_daily_connection_stats(days_back)`** - Daily connection analytics
8. **`get_game_completion_stats()`** - Game completion rate by type

### Cleanup & Maintenance

9. **`cleanup_old_websocket_connections(days_old)`** - Archive old connections
10. **`mark_stale_connections(timeout_minutes)`** - Mark inactive connections as timed out

## Triggers

### Auto-Update Triggers

1. **`trigger_auto_update_device_session`** - Automatically update device session on new connection
2. **`trigger_auto_record_reconnection`** - Track reconnections in device sessions

### Existing Triggers (from game system)

- Player count auto-update on join/leave
- Updated_at timestamp maintenance

## Row Level Security (RLS)

### Security Model

All tables use RLS with the following principles:

1. **Service Role Access**: Full access for backend operations
2. **User Access**: Users can view their own data
3. **Game Participant Access**: Participants can view game events
4. **Device-Based Access**: Uses `x-device-id` header for guest users

### Policies Implemented

- `websocket_connections`: Service role + own connections
- `device_sessions`: Service role + own sessions
- `game_events`: Service role + game participants
- `room_participants`: Service role + all can view, device-based insert

## Integration with Existing System

### Relationship to Game System

```
games (existing)
  ├── websocket_connections (new) - Track connections
  ├── device_sessions (new) - Aggregate device data
  ├── game_events (new) - Log all actions
  ├── room_participants (new) - Enhanced membership
  └── players (existing) - Base player identity
```

### Data Flow

1. **Connection Established**:
   - Insert into `websocket_connections`
   - Trigger updates `device_sessions`
   - Track reconnection count

2. **Game Join**:
   - Insert into `players` (existing)
   - Insert into `room_participants` (new)
   - Log event in `game_events`

3. **Game Action**:
   - Update game state in `games`/`game_flows`
   - Log event in `game_events` with auto-sequence

4. **Disconnection**:
   - Update `websocket_connections` status
   - Update `room_participants` status
   - Log disconnect event

## Migration Steps

### 1. Apply Migration

```bash
cd tuiz-backend
supabase db reset  # For dev/test
# OR
supabase db push   # For production
```

### 2. Verify Tables Created

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'websocket_connections',
  'device_sessions',
  'game_events',
  'room_participants'
);
```

### 3. Test Helper Functions

```sql
-- Test connection tracking
SELECT public.get_active_connections_count();

-- Test device session update
SELECT public.update_device_session('test_device_123', NULL, NULL, '{}'::jsonb);

-- Test event logging
SELECT public.log_game_event(
  'test_game_uuid'::uuid,
  'test_event',
  'test_action',
  NULL, NULL, NULL, NULL,
  '{"test": "data"}'::jsonb
);
```

## Next Steps for Backend Integration

### 1. Update ConnectionStore

Replace in-memory storage with database calls:

```typescript
// src/services/websocket/ConnectionStore.ts
import { supabaseAdmin } from '../../lib/supabase';

export class ConnectionStore {
  async addConnection(connection: ClientConnection): Promise<void> {
    await supabaseAdmin.from('websocket_connections').insert({
      socket_id: connection.socketId,
      device_id: connection.deviceId,
      user_id: connection.userId,
      reconnect_count: connection.reconnectCount,
      metadata: connection.metadata,
    });
  }

  // ... implement other methods with database queries
}
```

### 2. Add Event Logging to WebSocketManager

```typescript
// src/services/websocket/WebSocketManager.ts
async logGameEvent(gameId: string, eventType: string, data: any) {
  const { error } = await supabaseAdmin.rpc('log_game_event', {
    p_game_id: gameId,
    p_event_type: eventType,
    p_action: data.action,
    p_socket_id: data.socketId,
    p_device_id: data.deviceId,
    p_payload: data.payload,
  });

  if (error) logger.error({ error }, 'Failed to log game event');
}
```

### 3. Implement Cleanup Jobs

Create scheduled tasks for maintenance:

```typescript
// src/jobs/websocket-cleanup.ts
import { supabaseAdmin } from '../lib/supabase';

export async function cleanupOldConnections() {
  const { data, error } = await supabaseAdmin.rpc('cleanup_old_websocket_connections', {
    days_old: 30,
  });

  logger.info({ deleted: data }, 'Cleaned up old connections');
}

export async function markStaleConnections() {
  const { data, error } = await supabaseAdmin.rpc('mark_stale_connections', { timeout_minutes: 5 });

  logger.info({ marked: data }, 'Marked stale connections');
}
```

### 4. Add Redis Layer (Optional)

For production scaling with multiple servers:

```typescript
// Use Redis for hot data
// Use PostgreSQL for persistence and history
// Keep fallback to in-memory for dev
```

## Performance Considerations

### Indexes

All critical query patterns are indexed:

- Device lookups: `device_id` indexes
- Active connection filtering: Partial indexes on status
- Event replay: Composite `game_id + sequence_number`
- Time-based queries: Timestamp indexes

### RLS Performance

- Policies use indexed columns
- Service role bypasses RLS
- Minimal subquery depth

### Cleanup Strategy

- Automated cleanup functions for old data
- Configurable retention periods
- Stale connection detection

## Security Features

### Data Privacy

- IP address and user agent stored for security audit
- Metadata supports encryption if needed
- Device IDs are client-generated UUIDs (not PII)

### Access Control

- RLS prevents unauthorized data access
- Service role for backend operations
- Device-based authentication for guests

### Audit Trail

- Complete connection history
- All game events logged with timestamps
- Reconnection tracking for anomaly detection

## Analytics Capabilities

### Built-in Analytics Functions

1. **Daily connection stats** - Connections, unique devices, unique users
2. **Game completion rates** - By game type
3. **Device usage patterns** - Via device_sessions table
4. **Event sequences** - For game replay and analysis

### Custom Queries

The schema supports complex analytics:

- Player retention analysis
- Connection quality metrics
- Game flow optimization
- Cheat detection patterns

## Environment Variables

No new environment variables required. Uses existing Supabase configuration.

Optional additions for future enhancements:

```env
# WebSocket Configuration
WEBSOCKET_HEARTBEAT_TIMEOUT=60000
WEBSOCKET_ROOM_TTL=3600000
WEBSOCKET_LOG_EVENTS=true
WEBSOCKET_CLEANUP_INTERVAL=3600000
```

## Testing Checklist

- [ ] Migration applies without errors
- [ ] All tables created with correct schema
- [ ] Foreign keys established
- [ ] Indexes created
- [ ] RLS policies active
- [ ] Helper functions executable
- [ ] Triggers working
- [ ] Service role has full access
- [ ] User policies restrict correctly
- [ ] Cleanup functions work
- [ ] Analytics functions return data

## Documentation References

- **WEBSOCKET_DATABASE_REQUIREMENTS.md** - Original requirements
- **WEBSOCKET_IMPLEMENTATION_SUMMARY.md** - Current implementation
- **WEBSOCKET_API.md** - WebSocket event documentation
- **20251017061513_create_game_system.sql** - Base game system

## Migration Rollback

If needed, to rollback:

```sql
-- Drop new tables (cascades to foreign keys)
DROP TABLE IF EXISTS public.room_participants CASCADE;
DROP TABLE IF EXISTS public.game_events CASCADE;
DROP TABLE IF EXISTS public.device_sessions CASCADE;
DROP TABLE IF EXISTS public.websocket_connections CASCADE;

-- Drop custom type
DROP TYPE IF EXISTS connection_status CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.get_device_reconnect_count CASCADE;
DROP FUNCTION IF EXISTS public.get_active_connections_count CASCADE;
DROP FUNCTION IF EXISTS public.update_device_session CASCADE;
DROP FUNCTION IF EXISTS public.record_reconnection CASCADE;
DROP FUNCTION IF EXISTS public.log_game_event CASCADE;
DROP FUNCTION IF EXISTS public.get_game_event_sequence CASCADE;
DROP FUNCTION IF EXISTS public.get_daily_connection_stats CASCADE;
DROP FUNCTION IF EXISTS public.get_game_completion_stats CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_websocket_connections CASCADE;
DROP FUNCTION IF EXISTS public.mark_stale_connections CASCADE;
DROP FUNCTION IF EXISTS public.auto_update_device_session CASCADE;
DROP FUNCTION IF EXISTS public.auto_record_reconnection CASCADE;
```

## Conclusion

This migration provides a production-ready foundation for:

- ✅ WebSocket connection persistence
- ✅ Device session tracking
- ✅ Game event logging and replay
- ✅ Enhanced room participant tracking
- ✅ Analytics and reporting
- ✅ Audit and security
- ✅ Scalability for multi-server deployments

The schema integrates seamlessly with the existing game system while maintaining backward compatibility. The in-memory `ConnectionStore` can be gradually migrated to use these database tables without disrupting current functionality.
