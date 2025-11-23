# WebSocket API Documentation

A robust, production-ready WebSocket implementation for TUIZ with automatic reconnection, device tracking, and game-ready API.

## Features

✅ **Automatic Reconnection** - Seamless reconnection with exponential backoff  
✅ **Device ID Tracking** - Persistent device identification via localStorage  
✅ **Heartbeat Monitoring** - Keep connections alive and detect timeouts  
✅ **Room Management** - Join/leave rooms for multi-user games  
✅ **Game API** - Ready-to-use events for game development  
✅ **Connection History** - Track connection events for debugging  
✅ **Type Safety** - Full TypeScript support  
✅ **Singleton Pattern** - Single connection instance across the app

## Quick Start

### Frontend Usage

```typescript
import { useWebSocket } from '@/services/websocket';
import { cfg } from '@/config/config';

function MyComponent() {
  const ws = useWebSocket(cfg.apiBase, {
    onConnected: (status) => {
      console.log('Connected!', status);
    },
    onDisconnected: (reason) => {
      console.log('Disconnected:', reason);
    },
  });

  return (
    <div>
      <p>Status: {ws.isConnected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={() => ws.joinRoom('game-room-1')}>
        Join Room
      </button>
    </div>
  );
}
```

### Backend Usage

The WebSocket server is automatically initialized in `server.ts`. All connection handling, rooms, and game events are managed by the `WebSocketManager`.

## API Reference

### Frontend Hook: `useWebSocket`

```typescript
const ws = useWebSocket(apiUrl: string, events?: WebSocketServiceEvents);
```

**Returns:**

| Property          | Type                              | Description                     |
| ----------------- | --------------------------------- | ------------------------------- |
| `isConnected`     | boolean                           | Current connection status       |
| `status`          | ConnectionStatus                  | Detailed connection information |
| `connect`         | () => void                        | Manually connect                |
| `disconnect`      | () => void                        | Manually disconnect             |
| `reconnect`       | () => void                        | Force reconnection              |
| `joinRoom`        | (roomId) => void                  | Join a room                     |
| `leaveRoom`       | (roomId) => void                  | Leave a room                    |
| `sendRoomMessage` | (roomId, message) => void         | Send message to room            |
| `sendGameAction`  | (roomId, action, payload) => void | Send game action                |
| `sendGameState`   | (roomId, state) => void           | Update game state               |

### Connection Events

```typescript
interface WebSocketServiceEvents {
  onConnected?: (status: ConnectionStatus) => void;
  onDisconnected?: (reason: string) => void;
  onReconnecting?: (attemptNumber: number) => void;
  onError?: (error: Error) => void;
  onRoomJoined?: (info: RoomInfo) => void;
  onRoomLeft?: (roomId: string) => void;
  onRoomMessage?: (message: RoomMessage) => void;
  onRoomUserJoined?: (data: { roomId: string; socketId: string }) => void;
  onRoomUserLeft?: (data: { roomId: string; socketId: string }) => void;
  onGameAction?: (action: GameAction) => void;
  onGameState?: (state: GameState) => void;
}
```

## Connection Flow

### Initial Connection

```
Client                          Server
  |                               |
  |---- Socket Connect ---------->|
  |<--- socket.on('connect') -----|
  |                               |
  |---- ws:connect (deviceId) --->|
  |<--- ws:connected -------------|
  |     (socketId, deviceId,      |
  |      reconnectCount)          |
  |                               |
  |<--- ws:pong ------------------|
  |     (every 30s heartbeat)     |
```

### Reconnection Flow

```
Client                          Server
  |                               |
  |  Connection Lost              |
  |---- Reconnect Attempt 1 ----->|
  |     (exponential backoff)     |
  |<--- Connected ----------------|
  |                               |
  |---- ws:connect (deviceId) --->|
  |     (same device ID)          |
  |<--- ws:connected -------------|
  |     (reconnectCount: 1)       |
```

### Room Join Flow

```
Client                          Server
  |                               |
  |---- room:join (roomId) ------>|
  |                               |--- Add to room
  |<--- room:joined --------------|
  |     (roomId, clientCount)     |
  |                               |
  |<--- room:user-joined ---------|
  |     (broadcast to others)     |
```

## Device ID Management

Device IDs are automatically generated and stored in `localStorage` with key `tuiz_device_id`.

```typescript
// Get device ID
const deviceId = WebSocketService.getInstance().getDeviceId();

// Clear device ID (for testing)
WebSocketService.getInstance().clearDeviceId();
```

**Device ID Format:** `device_{timestamp}_{random}`

Example: `device_1732378235000_kj3h4k2j`

## Room Management

### Basic Room Operations

```typescript
// Join a room
ws.joinRoom('room-123');

// Send a message to everyone in the room
ws.sendRoomMessage('room-123', {
  text: 'Hello everyone!',
  type: 'chat',
});

// Leave the room
ws.leaveRoom('room-123');
```

### Room Events

```typescript
const ws = useWebSocket(apiUrl, {
  onRoomJoined: (info) => {
    console.log(`Joined ${info.roomId} with ${info.clients} clients`);
  },

  onRoomMessage: (message) => {
    console.log(`Message from ${message.from}:`, message.message);
  },

  onRoomUserJoined: (data) => {
    console.log(`User ${data.socketId} joined ${data.roomId}`);
  },

  onRoomUserLeft: (data) => {
    console.log(`User ${data.socketId} left ${data.roomId}`);
  },
});
```

## Game API

### Sending Game Actions

```typescript
// Example: Player movement
ws.sendGameAction('game-room-1', 'move', {
  x: 100,
  y: 200,
  direction: 'north',
});

// Example: Answer submission
ws.sendGameAction('quiz-room', 'submit_answer', {
  questionId: 'q123',
  answer: 'B',
  timeElapsed: 15.5,
});

// Example: Player action
ws.sendGameAction('game-room-1', 'attack', {
  targetId: 'player2',
  damage: 25,
});
```

### Updating Game State

```typescript
// Host updates game state
ws.sendGameState('game-room-1', {
  currentRound: 3,
  scores: {
    player1: 100,
    player2: 150,
  },
  timeRemaining: 30,
});
```

### Receiving Game Events

```typescript
const ws = useWebSocket(apiUrl, {
  onGameAction: (action) => {
    console.log(`Game action: ${action.action}`, action.payload);

    // Handle different actions
    switch (action.action) {
      case 'move':
        updatePlayerPosition(action.payload);
        break;
      case 'attack':
        handleAttack(action.payload);
        break;
      case 'submit_answer':
        processAnswer(action.payload);
        break;
    }
  },

  onGameState: (state) => {
    console.log('Game state updated:', state.state);
    // Update UI with new state
  },
});
```

## Testing

### Test Page

Visit `/websocket-test` to access the interactive test page with:

- Real-time connection status
- Manual connect/disconnect controls
- Room join/leave functionality
- Message sending interface
- Live event logs
- Connection history
- API usage examples

### Testing Reconnection

```typescript
// Simulate disconnect
WebSocketService.getInstance().simulateDisconnect();

// The service will automatically attempt to reconnect
```

### Manual Reconnection

```typescript
// Force reconnect
ws.reconnect();
```

## Configuration

### Frontend Configuration

```typescript
const config: WebSocketConfig = {
  url: 'http://localhost:3001',
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  heartbeatInterval: 30000,
};
```

### Backend Configuration

Heartbeat settings in `server.ts`:

```typescript
const io = new SocketIOServer(server, {
  pingInterval: 25000, // Send ping every 25 seconds
  pingTimeout: 20000, // Timeout if no pong in 20 seconds
});
```

## Advanced Usage

### Direct Service Access

```typescript
import { WebSocketService } from '@/services/websocket';

// Get singleton instance
const ws = WebSocketService.getInstance();

// Check connection
if (ws.isConnected()) {
  console.log('Already connected!');
}

// Get connection history
const history = ws.getConnectionHistory();
console.log('Connection events:', history);

// Get device ID
const deviceId = ws.getDeviceId();
```

### Custom Event Handlers

```typescript
const ws = WebSocketService.getInstance();

ws.on({
  onConnected: (status) => {
    // Track analytics
    analytics.track('websocket_connected', {
      socketId: status.socketId,
      reconnectCount: status.reconnectCount,
    });
  },

  onError: (error) => {
    // Log to error tracking service
    Sentry.captureException(error);
  },
});
```

## Architecture

### Backend Structure

```
tuiz-backend/src/services/websocket/
├── types.ts                 # TypeScript types and interfaces
├── ConnectionStore.ts       # In-memory connection and room store
├── WebSocketManager.ts      # Main WebSocket manager class
└── index.ts                 # Exports
```

### Frontend Structure

```
tuiz-frontend/src/services/websocket/
├── types.ts                 # TypeScript types and interfaces
├── WebSocketService.ts      # Singleton WebSocket service
├── useWebSocket.ts          # React hook for easy integration
└── index.ts                 # Exports
```

## Protocol Events

### Client → Server

| Event          | Payload                            | Description                        |
| -------------- | ---------------------------------- | ---------------------------------- |
| `ws:connect`   | `{ deviceId, userId?, metadata? }` | Register connection with device ID |
| `ws:heartbeat` | -                                  | Keep connection alive              |
| `room:join`    | `{ roomId }`                       | Join a room                        |
| `room:leave`   | `{ roomId }`                       | Leave a room                       |
| `room:message` | `{ roomId, message }`              | Send message to room               |
| `game:action`  | `{ roomId, action, payload }`      | Send game action                   |
| `game:state`   | `{ roomId, state }`                | Update game state                  |

### Server → Client

| Event              | Payload                                              | Description              |
| ------------------ | ---------------------------------------------------- | ------------------------ |
| `ws:connected`     | `{ socketId, deviceId, reconnectCount, serverTime }` | Connection confirmed     |
| `ws:error`         | `{ error, message }`                                 | Error occurred           |
| `ws:pong`          | -                                                    | Heartbeat response       |
| `room:joined`      | `{ roomId, clients }`                                | Successfully joined room |
| `room:left`        | `{ roomId }`                                         | Successfully left room   |
| `room:message`     | `{ roomId, from, message, timestamp }`               | Message from room        |
| `room:user-joined` | `{ roomId, socketId }`                               | User joined room         |
| `room:user-left`   | `{ roomId, socketId }`                               | User left room           |
| `game:action`      | `{ roomId, from, action, payload, timestamp }`       | Game action from player  |
| `game:state`       | `{ roomId, state }`                                  | Game state updated       |

## Error Handling

### Connection Errors

```typescript
const ws = useWebSocket(apiUrl, {
  onError: (error) => {
    if (error.message.includes('CORS')) {
      console.error('CORS error - check backend CORS settings');
    } else if (error.message.includes('timeout')) {
      console.error('Connection timeout - check network');
    } else {
      console.error('WebSocket error:', error.message);
    }
  },
});
```

### Room Errors

The server will emit `ws:error` if:

- Device ID is missing
- User is not registered
- Room operation fails

```typescript
const ws = useWebSocket(apiUrl, {
  onError: (error) => {
    // Display error to user
    toast.error(error.message);
  },
});
```

## Performance Considerations

### Connection Pooling

The service uses a singleton pattern, so only one WebSocket connection is created per browser session, regardless of how many components use the hook.

### Heartbeat Optimization

- Client sends heartbeat every 30 seconds
- Server checks for timeouts every 30 seconds
- Connections timeout after 60 seconds of no heartbeat

### Message Size

Keep message payloads reasonable:

- ✅ Small JSON objects (< 10KB)
- ✅ Primitive data types
- ❌ Large files or binary data (use HTTP upload instead)
- ❌ Complex nested objects

## Security Notes

### Device ID

- Device IDs are client-generated and not cryptographically secure
- For authenticated users, always include `userId` in connection info
- Don't rely solely on device ID for authorization

### Room Access

Currently, rooms are open. For production:

- Implement room authentication
- Add room passwords or invite codes
- Validate user permissions before joining

### Rate Limiting

Consider implementing rate limiting for:

- Messages per second per user
- Room joins per minute
- Game actions per second

See `WEBSOCKET_DATABASE_REQUIREMENTS.md` for database schema to support rate limiting.

## Troubleshooting

### Connection Issues

1. **Not connecting at all**
   - Check backend is running
   - Verify `cfg.apiBase` is correct
   - Check browser console for CORS errors

2. **Frequent disconnections**
   - Check network stability
   - Verify heartbeat settings
   - Check backend logs for errors

3. **Reconnection loops**
   - Check backend health
   - Verify device ID in localStorage
   - Clear cache and try again

### Room Issues

1. **Not receiving messages**
   - Verify you're in the room (`currentRoom` state)
   - Check event handlers are registered
   - Check browser console for errors

2. **Messages delayed**
   - Check network latency
   - Verify heartbeat is working
   - Check server load

## Next Steps

1. ✅ Test the WebSocket implementation on `/websocket-test`
2. ⏳ Implement database persistence (see `WEBSOCKET_DATABASE_REQUIREMENTS.md`)
3. ⏳ Add Redis for production scaling
4. ⏳ Implement game-specific logic
5. ⏳ Add room authentication
6. ⏳ Add rate limiting
7. ⏳ Add monitoring and analytics

## Support

For issues or questions:

1. Check the test page at `/websocket-test`
2. Review browser console logs
3. Check backend logs
4. Refer to `WEBSOCKET_DATABASE_REQUIREMENTS.md` for database setup

## License

Part of the TUIZ project.
