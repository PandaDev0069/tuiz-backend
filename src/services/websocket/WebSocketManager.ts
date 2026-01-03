// ====================================================
// File Name   : WebSocketManager.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-11-23
// Last Update : 2025-12-29

// Description:
// - Manager class for WebSocket connections and real-time game events
// - Handles socket lifecycle, room management, and game event broadcasting
// - Manages heartbeat monitoring and connection persistence

// Notes:
// - Uses ConnectionStore for in-memory connection tracking
// - Integrates with WebSocketPersistence for database operations
// - Supports late joiners with phase synchronization
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Server as SocketIOServer, Socket } from 'socket.io';

import { logger } from '../../utils/logger';

import { ConnectionStore } from './ConnectionStore';
import { ClientConnection, ConnectionInfo, WebSocketEvents, ServerEvents } from './types';
import { WebSocketPersistence } from './WebSocketPersistence';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const COUNTDOWN_LEAD_MS = 700;
const HEARTBEAT_CHECK_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 60000;

const DEFAULT_STARTS_AT = 0;
const DEFAULT_ENDS_AT = 0;
const DEFAULT_QUESTION_INDEX = 0;
const DEFAULT_ANSWER_COUNT = 0;
const DEFAULT_RANK_OFFSET = 1;
const DISCONNECT_FORCE = true;

const PHASE_COUNTDOWN = 'countdown';
const QUESTION_ID_UNKNOWN = 'unknown';
const EMPTY_STRING = '';

const EVENT_CONNECTION = 'connection';
const EVENT_DISCONNECT = 'disconnect';
const EVENT_WS_CONNECT = 'ws:connect';
const EVENT_WS_HEARTBEAT = 'ws:heartbeat';
const EVENT_WS_ERROR = 'ws:error';
const EVENT_WS_CONNECTED = 'ws:connected';
const EVENT_WS_PONG = 'ws:pong';
const EVENT_ROOM_JOIN = 'room:join';
const EVENT_ROOM_LEAVE = 'room:leave';
const EVENT_ROOM_MESSAGE = 'room:message';
const EVENT_ROOM_JOINED = 'room:joined';
const EVENT_ROOM_LEFT = 'room:left';
const EVENT_ROOM_USER_JOINED = 'room:user-joined';
const EVENT_ROOM_USER_LEFT = 'room:user-left';
const EVENT_GAME_STARTED = 'game:started';
const EVENT_GAME_ACTION = 'game:action';
const EVENT_GAME_STATE = 'game:state';
const EVENT_GAME_FLOW_START = 'game:flow:start';
const EVENT_GAME_FLOW_NEXT = 'game:flow:next';
const EVENT_GAME_FLOW_END = 'game:flow:end';
const EVENT_GAME_QUESTION_STARTED = 'game:question:started';
const EVENT_GAME_QUESTION_ENDED = 'game:question:ended';
const EVENT_GAME_QUESTION_CHANGED = 'game:question:changed';
const EVENT_GAME_PHASE_CHANGE = 'game:phase:change';
const EVENT_GAME_ANSWER_SUBMIT = 'game:answer:submit';
const EVENT_GAME_ANSWER_ACCEPTED = 'game:answer:accepted';
const EVENT_GAME_ANSWER_STATS_UPDATE = 'game:answer:stats:update';
const EVENT_GAME_LEADERBOARD_REQUEST = 'game:leaderboard:request';
const EVENT_GAME_LEADERBOARD_UPDATE = 'game:leaderboard:update';

const ERROR_INVALID_DEVICE_ID = 'invalid_device_id';
const ERROR_NOT_REGISTERED = 'not_registered';

const ERROR_MESSAGES = {
  DEVICE_ID_REQUIRED: 'Device ID is required',
  CONNECT_WITH_DEVICE_ID_FIRST: 'Please connect with device ID first',
} as const;

const LOG_MESSAGES = {
  MANAGER_INITIALIZED: 'WebSocket Manager initialized',
  NEW_SOCKET_CONNECTION: 'New socket connection',
  CLIENT_REGISTERED: 'Client registered',
  SOCKET_DISCONNECTED: 'Socket disconnected',
  FAILED_UPDATE_DISCONNECT_STATUS: 'Failed to update disconnect status',
  SOCKET_ALREADY_IN_ROOM: 'Socket already in room',
  SENT_CURRENT_PHASE_TO_JOINER: 'Sent current phase to new joiner',
  SOCKET_JOINED_ROOM: 'Socket joined room',
  SOCKET_LEFT_ROOM: 'Socket left room',
  MESSAGE_IN_ROOM: 'Message in room',
  GAME_ACTION_IN_ROOM: 'Game action in room',
  GAME_STATE_UPDATED: 'Game state updated in room',
  QUESTION_STARTED: 'Question started in room',
  QUESTION_CHANGED: 'Question changed in room',
  QUESTION_ENDED: 'Question ended in room',
  QUESTION_STARTED_DIRECT: 'Question started (direct) in room',
  QUESTION_ENDED_DIRECT: 'Question ended (direct) in room',
  PHASE_CHANGE: 'Phase change in room',
  GAME_STARTED_BROADCAST: 'Game started broadcast to room',
  ANSWER_SUBMITTED: 'Answer submitted in room',
  LEADERBOARD_REQUESTED: 'Leaderboard requested for room',
  CONNECTION_TIMED_OUT: 'Connection timed out',
  HEARTBEAT_CHECKER_STARTED: 'Heartbeat checker started',
  PHASE_CHANGE_BROADCAST: 'Phase change broadcast in room',
  MANAGER_SHUTDOWN: 'WebSocket Manager shutdown',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
type TypedSocket = Socket<WebSocketEvents, ServerEvents>;

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
/**
 * Class: WebSocketManager
 * Description:
 * - Manages WebSocket connections and real-time game events
 * - Handles socket lifecycle, room management, and event broadcasting
 * - Monitors connection health with heartbeat checking
 */
export class WebSocketManager {
  private io: SocketIOServer<WebSocketEvents, ServerEvents>;
  private store: ConnectionStore;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_CHECK_INTERVAL = HEARTBEAT_CHECK_INTERVAL_MS;
  private readonly HEARTBEAT_TIMEOUT = HEARTBEAT_TIMEOUT_MS;

  constructor(io: SocketIOServer<WebSocketEvents, ServerEvents>) {
    this.io = io;
    this.store = new ConnectionStore();
    this.initialize();
  }

  /**
   * Method: initialize
   * Description:
   * - Initializes WebSocket manager with connection handler
   * - Starts heartbeat checker for connection monitoring
   *
   * Returns:
   * - void: No return value
   */
  private initialize(): void {
    this.io.on(EVENT_CONNECTION, (socket: TypedSocket) => {
      this.handleConnection(socket);
    });

    this.startHeartbeatChecker();

    logger.info(LOG_MESSAGES.MANAGER_INITIALIZED);
  }

  /**
   * Method: handleConnection
   * Description:
   * - Sets up event handlers for a new socket connection
   * - Registers all WebSocket event listeners
   *
   * Parameters:
   * - socket (TypedSocket): The socket connection to handle
   *
   * Returns:
   * - void: No return value
   */
  private handleConnection(socket: TypedSocket): void {
    logger.info({ socketId: socket.id }, LOG_MESSAGES.NEW_SOCKET_CONNECTION);

    socket.on(EVENT_WS_CONNECT, (data: ConnectionInfo) => {
      this.registerClient(socket, data);
    });

    socket.on(EVENT_DISCONNECT, (reason) => {
      this.handleDisconnect(socket, reason);
    });

    socket.on(EVENT_WS_HEARTBEAT, () => {
      this.handleHeartbeat(socket);
    });

    socket.on(EVENT_ROOM_JOIN, (data) => {
      this.handleRoomJoin(socket, data.roomId);
    });

    socket.on(EVENT_ROOM_LEAVE, (data) => {
      this.handleRoomLeave(socket, data.roomId);
    });

    socket.on(EVENT_ROOM_MESSAGE, (data) => {
      this.handleRoomMessage(socket, data.roomId, data.message);
    });

    socket.on(EVENT_GAME_STARTED, (data) => {
      this.handleGameStarted(socket, data.roomId ?? data.gameId ?? EMPTY_STRING, data.roomCode);
    });

    socket.on(EVENT_GAME_ACTION, (data) => {
      this.handleGameAction(socket, data.roomId, data.action, data.payload);
    });

    socket.on(EVENT_GAME_STATE, (data) => {
      this.handleGameState(socket, data.roomId, data.state);
    });

    socket.on(EVENT_GAME_FLOW_START, (data) => {
      this.handleGameFlowStart(
        socket,
        data.roomId,
        data.questionId,
        data.startsAt ?? DEFAULT_STARTS_AT,
        data.endsAt ?? DEFAULT_ENDS_AT,
        data.questionIndex ?? DEFAULT_QUESTION_INDEX,
      );
    });

    socket.on(EVENT_GAME_FLOW_NEXT, (data) => {
      this.handleGameFlowNext(socket, data.roomId, data.nextQuestionId);
    });

    socket.on(EVENT_GAME_FLOW_END, (data) => {
      this.handleGameFlowEnd(socket, data.roomId);
    });

    socket.on(EVENT_GAME_QUESTION_STARTED, (data) => {
      this.handleQuestionStarted(socket, data.roomId, data.question, data.startsAt, data.endsAt);
    });

    socket.on(EVENT_GAME_QUESTION_ENDED, (data) => {
      this.handleQuestionEnded(socket, data.roomId, data.questionId);
    });

    socket.on(EVENT_GAME_PHASE_CHANGE, (data) => {
      this.handlePhaseChange(socket, data.roomId, data.phase);
    });

    socket.on(EVENT_GAME_ANSWER_SUBMIT, (data) => {
      this.handleAnswerSubmit(socket, data.roomId, data.playerId, data.questionId, data.answer);
    });

    socket.on(EVENT_GAME_LEADERBOARD_REQUEST, (data) => {
      this.handleLeaderboardRequest(socket, data.roomId);
    });
  }

  /**
   * Method: registerClient
   * Description:
   * - Registers a new client connection with device ID
   * - Persists connection to database and stores in memory
   * - Emits connection confirmation to client
   *
   * Parameters:
   * - socket (TypedSocket): The socket connection
   * - data (ConnectionInfo): Connection information with device ID
   *
   * Returns:
   * - Promise<void>: No return value
   */
  private async registerClient(socket: TypedSocket, data: ConnectionInfo): Promise<void> {
    const { deviceId, userId, metadata } = data;

    if (!deviceId) {
      socket.emit(EVENT_WS_ERROR, {
        error: ERROR_INVALID_DEVICE_ID,
        message: ERROR_MESSAGES.DEVICE_ID_REQUIRED,
      });
      return;
    }

    const { connectionId, reconnectCount } = await WebSocketPersistence.registerConnection(
      deviceId,
      socket.id,
      userId,
      metadata,
    );

    const connection: ClientConnection = {
      socketId: socket.id,
      deviceId,
      userId,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      reconnectCount,
      metadata,
      connectionId,
    };

    this.store.addConnection(connection);

    socket.emit(EVENT_WS_CONNECTED, {
      socketId: socket.id,
      deviceId,
      reconnectCount,
      serverTime: new Date().toISOString(),
    });

    logger.info(
      {
        socketId: socket.id,
        deviceId,
        reconnectCount,
        connectionId,
      },
      LOG_MESSAGES.CLIENT_REGISTERED,
    );
  }

  /**
   * Method: handleDisconnect
   * Description:
   * - Handles socket disconnection
   * - Updates database and removes from store
   *
   * Parameters:
   * - socket (TypedSocket): The socket that disconnected
   * - reason (string): Disconnection reason
   *
   * Returns:
   * - void: No return value
   */
  private handleDisconnect(socket: TypedSocket, reason: string): void {
    logger.info({ socketId: socket.id, reason }, LOG_MESSAGES.SOCKET_DISCONNECTED);

    const connection = this.store.getConnection(socket.id);
    if (connection && connection.connectionId) {
      WebSocketPersistence.handleDisconnect(connection.connectionId).catch((err) => {
        logger.error({ err }, LOG_MESSAGES.FAILED_UPDATE_DISCONNECT_STATUS);
      });
    }

    this.store.removeConnection(socket.id);
  }

  /**
   * Method: handleHeartbeat
   * Description:
   * - Updates heartbeat timestamp for connection
   * - Responds with pong to client
   *
   * Parameters:
   * - socket (TypedSocket): The socket sending heartbeat
   *
   * Returns:
   * - void: No return value
   */
  private handleHeartbeat(socket: TypedSocket): void {
    this.store.updateHeartbeat(socket.id);
    socket.emit(EVENT_WS_PONG);
  }

  /**
   * Method: handleRoomJoin
   * Description:
   * - Handles client joining a room
   * - Sends current phase to late joiners
   * - Notifies other clients in room
   *
   * Parameters:
   * - socket (TypedSocket): The socket joining
   * - roomId (string): Room identifier
   *
   * Returns:
   * - void: No return value
   */
  private handleRoomJoin(socket: TypedSocket, roomId: string): void {
    const connection = this.store.getConnection(socket.id);
    if (!connection) {
      socket.emit(EVENT_WS_ERROR, {
        error: ERROR_NOT_REGISTERED,
        message: ERROR_MESSAGES.CONNECT_WITH_DEVICE_ID_FIRST,
      });
      return;
    }

    const room = this.store.getRoom(roomId);
    const wasAlreadyInRoom = room?.clients.has(socket.id) || false;

    if (!wasAlreadyInRoom) {
      socket.join(roomId);
    }

    const added = this.store.addToRoom(socket.id, roomId);

    if (!added || wasAlreadyInRoom) {
      const currentRoom = this.store.getRoom(roomId);
      const clientCount = currentRoom ? currentRoom.clients.size : DEFAULT_ANSWER_COUNT;
      socket.emit(EVENT_ROOM_JOINED, { roomId, clients: clientCount });
      logger.debug(
        {
          socketId: socket.id,
          roomId,
          clientCount,
        },
        LOG_MESSAGES.SOCKET_ALREADY_IN_ROOM,
      );
      return;
    }

    const updatedRoom = this.store.getRoom(roomId);
    const clientCount = updatedRoom ? updatedRoom.clients.size : DEFAULT_ANSWER_COUNT;

    socket.emit(EVENT_ROOM_JOINED, { roomId, clients: clientCount });

    socket.to(roomId).emit(EVENT_ROOM_USER_JOINED, {
      roomId,
      socketId: socket.id,
    });

    if (room) {
      const currentPhase = room.gameData?.currentPhase as string | undefined;
      if (currentPhase) {
        const phaseData: { roomId: string; phase: string; startedAt?: number } = {
          roomId,
          phase: currentPhase,
        };

        if (currentPhase === PHASE_COUNTDOWN && room.gameData?.countdownStartedAt) {
          phaseData.startedAt = room.gameData.countdownStartedAt as number;
        }

        socket.emit(EVENT_GAME_PHASE_CHANGE, phaseData);
        logger.debug(
          {
            socketId: socket.id,
            phase: currentPhase,
          },
          LOG_MESSAGES.SENT_CURRENT_PHASE_TO_JOINER,
        );
      }
    }

    logger.info(
      {
        socketId: socket.id,
        roomId,
        clientCount,
      },
      LOG_MESSAGES.SOCKET_JOINED_ROOM,
    );
  }

  /**
   * Method: handleRoomLeave
   * Description:
   * - Handles client leaving a room
   * - Notifies other clients in room
   *
   * Parameters:
   * - socket (TypedSocket): The socket leaving
   * - roomId (string): Room identifier
   *
   * Returns:
   * - void: No return value
   */
  private handleRoomLeave(socket: TypedSocket, roomId: string): void {
    socket.leave(roomId);

    this.store.removeFromRoom(socket.id, roomId);

    socket.emit(EVENT_ROOM_LEFT, { roomId });

    socket.to(roomId).emit(EVENT_ROOM_USER_LEFT, {
      roomId,
      socketId: socket.id,
    });

    logger.info({ socketId: socket.id, roomId }, LOG_MESSAGES.SOCKET_LEFT_ROOM);
  }

  /**
   * Method: handleRoomMessage
   * Description:
   * - Broadcasts message to all clients in room
   *
   * Parameters:
   * - socket (TypedSocket): The socket sending message
   * - roomId (string): Room identifier
   * - message (unknown): Message content
   *
   * Returns:
   * - void: No return value
   */
  private handleRoomMessage(socket: TypedSocket, roomId: string, message: unknown): void {
    const connection = this.store.getConnection(socket.id);
    if (!connection) return;

    this.io.to(roomId).emit(EVENT_ROOM_MESSAGE, {
      roomId,
      from: socket.id,
      message,
      timestamp: new Date().toISOString(),
    });

    logger.info({ socketId: socket.id, roomId }, LOG_MESSAGES.MESSAGE_IN_ROOM);
  }

  /**
   * Method: handleGameAction
   * Description:
   * - Broadcasts game action to all clients in room
   *
   * Parameters:
   * - socket (TypedSocket): The socket sending action
   * - roomId (string): Room identifier
   * - action (string): Action identifier
   * - payload (unknown): Action payload
   *
   * Returns:
   * - void: No return value
   */
  private handleGameAction(
    socket: TypedSocket,
    roomId: string,
    action: string,
    payload: unknown,
  ): void {
    const connection = this.store.getConnection(socket.id);
    if (!connection) return;

    this.io.to(roomId).emit(EVENT_GAME_ACTION, {
      roomId,
      from: socket.id,
      action,
      payload,
      timestamp: new Date().toISOString(),
    });

    logger.info({ socketId: socket.id, roomId, action }, LOG_MESSAGES.GAME_ACTION_IN_ROOM);
  }

  /**
   * Method: handleGameState
   * Description:
   * - Updates and broadcasts game state to all clients in room
   *
   * Parameters:
   * - socket (TypedSocket): The socket sending state
   * - roomId (string): Room identifier
   * - state (unknown): Game state data
   *
   * Returns:
   * - void: No return value
   */
  private handleGameState(socket: TypedSocket, roomId: string, state: unknown): void {
    const connection = this.store.getConnection(socket.id);
    if (!connection) return;

    const room = this.store.getRoom(roomId);
    if (room) {
      room.gameData = { ...(room.gameData || {}), state };
    }

    this.io.to(roomId).emit(EVENT_GAME_STATE, {
      roomId,
      state,
    });

    logger.info({ roomId }, LOG_MESSAGES.GAME_STATE_UPDATED);
  }

  /**
   * Method: handleGameFlowStart
   * Description:
   * - Handles game flow start event
   * - Updates room game data and broadcasts question started
   *
   * Parameters:
   * - socket (TypedSocket): The socket triggering event
   * - roomId (string): Room identifier
   * - questionId (string): Question identifier
   * - startsAt (number): Question start timestamp
   * - endsAt (number): Question end timestamp
   * - questionIndex (number | undefined): Optional question index
   *
   * Returns:
   * - void: No return value
   */
  private handleGameFlowStart(
    socket: TypedSocket,
    roomId: string,
    questionId: string,
    startsAt: number,
    endsAt: number,
    questionIndex?: number,
  ): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    room.gameData = {
      ...(room.gameData || {}),
      currentQuestionId: questionId,
      questionWindow: { startsAt, endsAt },
      answerCounts: new Map<string, number>(),
      scores: room.gameData?.scores || {},
    };

    this.io.to(roomId).emit(EVENT_GAME_QUESTION_STARTED, {
      roomId,
      question: { id: questionId, index: questionIndex },
      startsAt,
      endsAt,
    });

    logger.info({ roomId, questionId }, LOG_MESSAGES.QUESTION_STARTED);
  }

  /**
   * Method: handleGameFlowNext
   * Description:
   * - Handles moving to next question in game flow
   * - Updates room game data and broadcasts question changed
   *
   * Parameters:
   * - socket (TypedSocket): The socket triggering event
   * - roomId (string): Room identifier
   * - nextQuestionId (string): Next question identifier
   *
   * Returns:
   * - void: No return value
   */
  private handleGameFlowNext(socket: TypedSocket, roomId: string, nextQuestionId: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    room.gameData = {
      ...(room.gameData || {}),
      currentQuestionId: nextQuestionId,
      answerCounts: new Map<string, number>(),
    };

    this.io.to(roomId).emit(EVENT_GAME_QUESTION_CHANGED, {
      roomId,
      question: { id: nextQuestionId },
    });

    logger.info({ roomId, questionId: nextQuestionId }, LOG_MESSAGES.QUESTION_CHANGED);
  }

  /**
   * Method: handleGameFlowEnd
   * Description:
   * - Handles ending current question in game flow
   * - Clears question data and broadcasts question ended
   *
   * Parameters:
   * - socket (TypedSocket): The socket triggering event
   * - roomId (string): Room identifier
   *
   * Returns:
   * - void: No return value
   */
  private handleGameFlowEnd(socket: TypedSocket, roomId: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    if (room.gameData) {
      delete room.gameData.questionWindow;
      delete room.gameData.currentQuestionId;
    }

    this.io.to(roomId).emit(EVENT_GAME_QUESTION_ENDED, { roomId, questionId: undefined });
    logger.info({ roomId }, LOG_MESSAGES.QUESTION_ENDED);
  }

  /**
   * Method: handleQuestionStarted
   * Description:
   * - Handles direct question started event
   * - Updates room game data and broadcasts to all clients
   *
   * Parameters:
   * - socket (TypedSocket): The socket triggering event
   * - roomId (string): Room identifier
   * - question (object): Question data with id and optional index
   * - startsAt (number | undefined): Optional start timestamp
   * - endsAt (number | undefined): Optional end timestamp
   *
   * Returns:
   * - void: No return value
   */
  private handleQuestionStarted(
    socket: TypedSocket,
    roomId: string,
    question: { id: string; index?: number },
    startsAt?: number,
    endsAt?: number,
  ): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    room.gameData = {
      ...(room.gameData || {}),
      currentQuestionId: question.id,
      questionWindow:
        startsAt && endsAt ? { startsAt, endsAt } : room.gameData?.questionWindow || undefined,
      answerCounts: room.gameData?.answerCounts || new Map<string, number>(),
      scores: room.gameData?.scores || {},
    };

    this.io.to(roomId).emit(EVENT_GAME_QUESTION_STARTED, {
      roomId,
      question,
      startsAt,
      endsAt,
    });

    logger.info({ roomId, questionId: question.id }, LOG_MESSAGES.QUESTION_STARTED_DIRECT);
  }

  /**
   * Method: handleQuestionEnded
   * Description:
   * - Handles direct question ended event
   * - Clears question data and broadcasts to all clients
   *
   * Parameters:
   * - socket (TypedSocket): The socket triggering event
   * - roomId (string): Room identifier
   * - questionId (string | undefined): Optional question identifier
   *
   * Returns:
   * - void: No return value
   */
  private handleQuestionEnded(socket: TypedSocket, roomId: string, questionId?: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    if (room.gameData) {
      delete room.gameData.questionWindow;
      delete room.gameData.currentQuestionId;
    }

    this.io.to(roomId).emit(EVENT_GAME_QUESTION_ENDED, { roomId, questionId });
    logger.info(
      {
        roomId,
        questionId: questionId || QUESTION_ID_UNKNOWN,
      },
      LOG_MESSAGES.QUESTION_ENDED_DIRECT,
    );
  }

  /**
   * Method: handlePhaseChange
   * Description:
   * - Handles game phase change event
   * - Stores phase for late joiners and broadcasts to all clients
   * - Handles countdown phase with timestamp synchronization
   *
   * Parameters:
   * - socket (TypedSocket): The socket triggering event
   * - roomId (string): Room identifier
   * - phase (string): Phase identifier
   *
   * Returns:
   * - void: No return value
   */
  private handlePhaseChange(socket: TypedSocket, roomId: string, phase: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const gameData = room.gameData || {};
    gameData.currentPhase = phase;

    const phaseData: { roomId: string; phase: string; startedAt?: number } = { roomId, phase };
    if (phase === PHASE_COUNTDOWN) {
      const startedAt =
        (gameData.countdownStartedAt as number | undefined) ?? Date.now() + COUNTDOWN_LEAD_MS;
      gameData.countdownStartedAt = startedAt;
      phaseData.startedAt = startedAt;
    }

    room.gameData = gameData;

    this.io.to(roomId).emit(EVENT_GAME_PHASE_CHANGE, phaseData);
    logger.info({ roomId, phase }, LOG_MESSAGES.PHASE_CHANGE);
  }

  /**
   * Method: handleGameStarted
   * Description:
   * - Handles game started event
   * - Sets countdown phase and broadcasts to all clients
   *
   * Parameters:
   * - socket (TypedSocket): The socket triggering event
   * - roomId (string): Room identifier
   * - roomCode (string | undefined): Optional room code
   *
   * Returns:
   * - void: No return value
   */
  private handleGameStarted(socket: TypedSocket, roomId: string, roomCode?: string): void {
    if (!roomId) return;
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const gameData = room.gameData || {};
    const startedAt =
      (gameData.countdownStartedAt as number | undefined) ?? Date.now() + COUNTDOWN_LEAD_MS;
    gameData.countdownStartedAt = startedAt;
    gameData.currentPhase = gameData.currentPhase || PHASE_COUNTDOWN;
    room.gameData = gameData;

    this.io.to(roomId).emit(EVENT_GAME_STARTED, { roomId, roomCode, gameId: roomId, startedAt });
    logger.info({ roomId }, LOG_MESSAGES.GAME_STARTED_BROADCAST);
  }

  /**
   * Method: handleAnswerSubmit
   * Description:
   * - Handles answer submission from player
   * - Updates answer counts and broadcasts stats to all clients
   *
   * Parameters:
   * - socket (TypedSocket): The socket submitting answer
   * - roomId (string): Room identifier
   * - playerId (string): Player identifier
   * - questionId (string): Question identifier
   * - answer (string | number): Submitted answer
   *
   * Returns:
   * - void: No return value
   */
  private handleAnswerSubmit(
    socket: TypedSocket,
    roomId: string,
    playerId: string,
    questionId: string,
    answer: string | number,
  ): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const gd = (room.gameData = { ...(room.gameData || {}) });
    const counts =
      (gd.answerCounts as Map<string, number> | undefined) || new Map<string, number>();
    gd.answerCounts = counts;
    const key = String(answer);
    const nextCount = (counts.get(key) ?? DEFAULT_ANSWER_COUNT) + DEFAULT_RANK_OFFSET;
    counts.set(key, nextCount);

    socket.emit(EVENT_GAME_ANSWER_ACCEPTED, {
      roomId,
      playerId,
      questionId,
      submittedAt: new Date().toISOString(),
    });

    const answerCounts = Object.fromEntries(counts);
    this.io.to(roomId).emit(EVENT_GAME_ANSWER_STATS_UPDATE, {
      roomId,
      questionId,
      counts: answerCounts,
    });

    logger.info({ roomId, playerId, questionId }, LOG_MESSAGES.ANSWER_SUBMITTED);
  }

  /**
   * Method: handleLeaderboardRequest
   * Description:
   * - Handles leaderboard request from client
   * - Calculates rankings from scores and sends to requester
   *
   * Parameters:
   * - socket (TypedSocket): The socket requesting leaderboard
   * - roomId (string): Room identifier
   *
   * Returns:
   * - void: No return value
   */
  private handleLeaderboardRequest(socket: TypedSocket, roomId: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const scores = (room.gameData?.scores as Record<string, number>) || {};
    const rankings = Object.entries(scores)
      .map(([playerId, score]) => ({ playerId, score }))
      .sort((a, b) => b.score - a.score)
      .map((entry, idx) => ({ ...entry, rank: idx + DEFAULT_RANK_OFFSET }));

    socket.emit(EVENT_GAME_LEADERBOARD_UPDATE, { roomId, rankings });
    logger.info({ roomId }, LOG_MESSAGES.LEADERBOARD_REQUESTED);
  }

  /**
   * Method: startHeartbeatChecker
   * Description:
   * - Starts periodic heartbeat monitoring
   * - Disconnects clients that haven't sent heartbeat within timeout
   *
   * Returns:
   * - void: No return value
   */
  private startHeartbeatChecker(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const connections = this.store.getAllConnections();

      connections.forEach((connection) => {
        const timeSinceHeartbeat = now - connection.lastHeartbeat.getTime();

        if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT) {
          logger.warn(
            {
              socketId: connection.socketId,
              timeSinceHeartbeat,
            },
            LOG_MESSAGES.CONNECTION_TIMED_OUT,
          );

          const socket = this.io.sockets.sockets.get(connection.socketId);
          if (socket) {
            socket.disconnect(DISCONNECT_FORCE);
          }

          this.store.removeConnection(connection.socketId);
        }
      });
    }, this.HEARTBEAT_CHECK_INTERVAL);

    logger.info(LOG_MESSAGES.HEARTBEAT_CHECKER_STARTED);
  }

  /**
   * Method: getStore
   * Description:
   * - Returns the connection store instance
   *
   * Returns:
   * - ConnectionStore: The connection store
   */
  public getStore(): ConnectionStore {
    return this.store;
  }

  /**
   * Method: getStats
   * Description:
   * - Returns manager statistics including store stats and uptime
   *
   * Returns:
   * - object: Statistics object with store stats and process uptime
   */
  public getStats() {
    return {
      ...this.store.getStats(),
      uptime: process.uptime(),
    };
  }

  /**
   * Method: disconnect
   * Description:
   * - Manually disconnects a socket by ID
   *
   * Parameters:
   * - socketId (string): Socket identifier to disconnect
   *
   * Returns:
   * - void: No return value
   */
  public disconnect(socketId: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect(DISCONNECT_FORCE);
    }
  }

  /**
   * Method: broadcastToRoom
   * Description:
   * - Broadcasts a typed event to all clients in a room
   *
   * Parameters:
   * - roomId (string): Room identifier
   * - event (K): Event name from ServerEvents
   * - args: Event arguments
   *
   * Returns:
   * - void: No return value
   */
  public broadcastToRoom<K extends keyof ServerEvents>(
    roomId: string,
    event: K,
    ...args: Parameters<ServerEvents[K]>
  ): void {
    this.io.to(roomId).emit(event, ...args);
  }

  /**
   * Method: broadcastPhaseChange
   * Description:
   * - Broadcasts phase change with proper handling
   * - Adds startedAt timestamp for countdown phase synchronization
   *
   * Parameters:
   * - roomId (string): Room identifier
   * - phase (string): Phase identifier
   *
   * Returns:
   * - void: No return value
   */
  public broadcastPhaseChange(roomId: string, phase: string): void {
    const room = this.store.getRoom(roomId) || this.store.createRoom(roomId);
    const gameData = room.gameData || {};
    gameData.currentPhase = phase;

    const phaseData: { roomId: string; phase: string; startedAt?: number } = { roomId, phase };
    if (phase === PHASE_COUNTDOWN) {
      const startedAt =
        (gameData.countdownStartedAt as number | undefined) ?? Date.now() + COUNTDOWN_LEAD_MS;
      gameData.countdownStartedAt = startedAt;
      phaseData.startedAt = startedAt;
    }

    room.gameData = gameData;
    this.io.to(roomId).emit(EVENT_GAME_PHASE_CHANGE, phaseData);
    logger.info({ roomId, phase }, LOG_MESSAGES.PHASE_CHANGE_BROADCAST);
  }

  /**
   * Method: shutdown
   * Description:
   * - Shuts down the WebSocket manager
   * - Clears heartbeat interval and connection store
   *
   * Returns:
   * - void: No return value
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.store.clear();
    logger.info(LOG_MESSAGES.MANAGER_SHUTDOWN);
  }
}
