# WebSocket Database Requirements

This document outlines the database schema requirements for persisting WebSocket connection data and game state for production use.

## Overview

Currently, the WebSocket implementation uses in-memory storage via `ConnectionStore`. For production deployment, especially with multiple server instances or for persistent connection tracking and game state, the following database tables/collections are recommended.

## Database Tables/Collections

### 1. `websocket_connections`

Tracks active and historical WebSocket connections.

**Schema:**

| Column            | Type         | Description                                                      |
| ----------------- | ------------ | ---------------------------------------------------------------- |
| `id`              | UUID         | Primary key                                                      |
| `socket_id`       | VARCHAR(255) | Socket.IO connection ID                                          |
| `device_id`       | VARCHAR(255) | Unique device identifier from localStorage                       |
| `user_id`         | UUID         | User ID (nullable, if authenticated)                             |
| `connected_at`    | TIMESTAMP    | When the connection was established                              |
| `disconnected_at` | TIMESTAMP    | When the connection was closed (nullable for active connections) |
| `last_heartbeat`  | TIMESTAMP    | Last heartbeat received                                          |
| `reconnect_count` | INTEGER      | Number of reconnections for this device                          |
| `ip_address`      | VARCHAR(45)  | Client IP address                                                |
| `user_agent`      | TEXT         | Browser user agent                                               |
| `metadata`        | JSONB        | Additional connection metadata                                   |
| `status`          | ENUM         | 'active', 'disconnected', 'timeout'                              |

**Indexes:**

- `device_id` (for quick lookup of device history)
- `user_id` (for user connection history)
- `status` (for filtering active connections)
- `connected_at` (for time-based queries)

**Usage:**

- Track connection history per device
- Identify reconnections
- Monitor active connections
- Audit and analytics

### 2. `game_rooms`

Stores game room information and state.

**Schema:**

| Column            | Type         | Description                                               |
| ----------------- | ------------ | --------------------------------------------------------- |
| `id`              | UUID         | Primary key                                               |
| `room_id`         | VARCHAR(255) | Unique room identifier                                    |
| `created_at`      | TIMESTAMP    | When the room was created                                 |
| `updated_at`      | TIMESTAMP    | Last update timestamp                                     |
| `closed_at`       | TIMESTAMP    | When the room was closed (nullable for active rooms)      |
| `created_by`      | UUID         | User/device that created the room                         |
| `game_type`       | VARCHAR(100) | Type of game (e.g., 'quiz', 'puzzle', 'trivia')           |
| `game_data`       | JSONB        | Game-specific state and configuration                     |
| `status`          | ENUM         | 'active', 'waiting', 'in_progress', 'completed', 'closed' |
| `max_players`     | INTEGER      | Maximum number of players allowed                         |
| `current_players` | INTEGER      | Current number of players                                 |

**Indexes:**

- `room_id` (unique)
- `status` (for filtering active rooms)
- `game_type` (for game-specific queries)
- `created_at` (for time-based queries)

**Usage:**

- Persist room state across server restarts
- Track game history
- Enable room discovery
- Store game configuration

### 3. `room_participants`

Tracks which connections/users are in which rooms.

**Schema:**

| Column      | Type         | Description                                        |
| ----------- | ------------ | -------------------------------------------------- |
| `id`        | UUID         | Primary key                                        |
| `room_id`   | VARCHAR(255) | Reference to game room                             |
| `socket_id` | VARCHAR(255) | Current socket connection ID                       |
| `device_id` | VARCHAR(255) | Device identifier                                  |
| `user_id`   | UUID         | User ID (nullable)                                 |
| `joined_at` | TIMESTAMP    | When they joined                                   |
| `left_at`   | TIMESTAMP    | When they left (nullable for active participants)  |
| `role`      | VARCHAR(50)  | Role in room (e.g., 'host', 'player', 'spectator') |
| `status`    | ENUM         | 'active', 'disconnected', 'left'                   |

**Indexes:**

- `room_id` (for room member lookups)
- `device_id` (for participant history)
- `socket_id` (for quick participant lookup)
- `status` (for filtering active participants)

**Usage:**

- Track room membership
- Handle reconnections to same room
- Manage room capacity
- Participant history

### 4. `game_events`

Logs game actions and events for replay, analytics, and debugging.

**Schema:**

| Column            | Type         | Description                                            |
| ----------------- | ------------ | ------------------------------------------------------ |
| `id`              | UUID         | Primary key                                            |
| `room_id`         | VARCHAR(255) | Room where event occurred                              |
| `event_type`      | VARCHAR(100) | Type of event (e.g., 'move', 'answer', 'state_change') |
| `socket_id`       | VARCHAR(255) | Socket that triggered the event                        |
| `device_id`       | VARCHAR(255) | Device identifier                                      |
| `user_id`         | UUID         | User ID (nullable)                                     |
| `timestamp`       | TIMESTAMP    | When the event occurred                                |
| `action`          | VARCHAR(255) | Action name                                            |
| `payload`         | JSONB        | Event data                                             |
| `sequence_number` | INTEGER      | Event order in the room                                |

**Indexes:**

- `room_id` (for room event history)
- `timestamp` (for time-based queries)
- `event_type` (for filtering by event type)
- `sequence_number` (for ordered replay)

**Usage:**

- Game event replay
- Analytics and insights
- Debugging game issues
- Cheat detection

### 5. `device_sessions`

Tracks device session history for user identification.

**Schema:**

| Column                | Type         | Description                   |
| --------------------- | ------------ | ----------------------------- |
| `id`                  | UUID         | Primary key                   |
| `device_id`           | VARCHAR(255) | Unique device identifier      |
| `user_id`             | UUID         | Associated user ID (nullable) |
| `first_seen`          | TIMESTAMP    | First time device connected   |
| `last_seen`           | TIMESTAMP    | Last connection time          |
| `total_connections`   | INTEGER      | Total number of connections   |
| `total_reconnections` | INTEGER      | Total number of reconnections |
| `browser_fingerprint` | VARCHAR(255) | Browser fingerprint hash      |
| `metadata`            | JSONB        | Device and browser info       |

**Indexes:**

- `device_id` (unique)
- `user_id` (for user device mapping)
- `last_seen` (for active device tracking)

**Usage:**

- Link devices to users
- Track device usage patterns
- Detect multiple devices per user
- Account recovery

## Redis/Cache Layer (Recommended)

For high-performance real-time operations, use Redis for:

### Redis Data Structures

1. **Active Connections** (Hash)
   - Key: `ws:connections:{device_id}`
   - Value: JSON with socket_id, connected_at, last_heartbeat
   - TTL: 5 minutes after disconnect

2. **Active Rooms** (Hash)
   - Key: `ws:room:{room_id}`
   - Value: JSON with room state, participants
   - TTL: 1 hour after room closes

3. **Socket-to-Device Mapping** (String)
   - Key: `ws:socket:{socket_id}`
   - Value: device_id
   - TTL: 5 minutes after disconnect

4. **Room Participants** (Set)
   - Key: `ws:room:{room_id}:participants`
   - Members: socket_id values
   - TTL: 1 hour after room closes

5. **Presence** (Sorted Set)
   - Key: `ws:presence`
   - Score: last_heartbeat timestamp
   - Member: socket_id

## Migration Strategy

1. **Phase 1: Add Database Tables**
   - Create tables with schema above
   - Keep in-memory store operational

2. **Phase 2: Dual Write**
   - Write to both in-memory and database
   - Read from in-memory for performance
   - Verify data consistency

3. **Phase 3: Add Redis Layer**
   - Introduce Redis for real-time data
   - Use database for persistence and history
   - Keep in-memory as fallback

4. **Phase 4: Full Migration**
   - Use Redis as primary real-time store
   - Use PostgreSQL/Supabase for persistence
   - Remove in-memory store
   - Add background jobs for cleanup

## Queries Needed

### Connection Tracking

```sql
-- Get reconnection count for device
SELECT COUNT(*) as reconnect_count
FROM websocket_connections
WHERE device_id = ? AND status = 'disconnected';

-- Get active connections
SELECT * FROM websocket_connections
WHERE status = 'active'
ORDER BY connected_at DESC;
```

### Room Management

```sql
-- Get active rooms
SELECT * FROM game_rooms
WHERE status = 'active'
ORDER BY created_at DESC;

-- Get room participants
SELECT * FROM room_participants
WHERE room_id = ? AND status = 'active';
```

### Analytics

```sql
-- Daily connection stats
SELECT DATE(connected_at) as date,
       COUNT(*) as total_connections,
       COUNT(DISTINCT device_id) as unique_devices
FROM websocket_connections
WHERE connected_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(connected_at)
ORDER BY date DESC;

-- Game completion rate
SELECT game_type,
       COUNT(*) as total_games,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_games
FROM game_rooms
GROUP BY game_type;
```

## Implementation Notes

1. **Use Supabase** (Already in stack)
   - Create tables in existing Supabase instance
   - Use Supabase Realtime for room updates if needed
   - Leverage Row Level Security for data protection

2. **Connection Lifecycle**
   - On connect: INSERT into websocket_connections
   - On heartbeat: UPDATE last_heartbeat
   - On disconnect: UPDATE status and disconnected_at
   - On reconnect: INCREMENT reconnect_count

3. **Room Lifecycle**
   - On create: INSERT into game_rooms
   - On join: INSERT into room_participants
   - On state change: UPDATE game_data in game_rooms
   - On event: INSERT into game_events
   - On close: UPDATE status and closed_at

4. **Cleanup Jobs**
   - Archive old connections (> 30 days)
   - Close abandoned rooms (no activity > 1 hour)
   - Prune disconnected participants (> 5 minutes)

## Environment Variables

Add to `.env`:

```
# WebSocket Configuration
REDIS_URL=redis://localhost:6379
WEBSOCKET_HEARTBEAT_TIMEOUT=60000
WEBSOCKET_ROOM_TTL=3600000
WEBSOCKET_LOG_EVENTS=true
```

## Security Considerations

1. **Rate Limiting**
   - Limit connections per device
   - Limit room creation per user
   - Limit events per second per connection

2. **Data Privacy**
   - Hash sensitive device information
   - Encrypt user_agent strings
   - Comply with GDPR/data retention policies

3. **Access Control**
   - Verify user permissions for room actions
   - Validate device_id authenticity
   - Implement room join codes/passwords if needed

## Next Steps

1. Review and approve schema
2. Create migration files for Supabase
3. Implement database integration in WebSocketManager
4. Add Redis layer for production scaling
5. Implement cleanup jobs
6. Add monitoring and alerting
