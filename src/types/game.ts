// ====================================================
// File Name   : game.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-11-19
// Last Update : 2025-12-22

// Description:
// - Comprehensive game type definitions for multiplayer quiz games
// - Real-time game flow, player management, and leaderboard tracking
// - Socket.IO event payloads for client-server communication
// - Zod validation schemas for all game operations

// Notes:
// - Game lifecycle: WAITING → ACTIVE → PAUSED/FINISHED
// - Max 200 players per game
// - Host player created automatically during game initialization
// - Game codes are 10-character alphanumeric strings
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { z } from 'zod';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const GAME_CODE_LENGTH = 10;
const GAME_CODE_PATTERN = /^[A-Z0-9]+$/;

const STRING_MIN_LENGTH = 1;
const PLAYER_NAME_MAX_LENGTH = 100;
const DEVICE_ID_MAX_LENGTH = 100;

const TOTAL_QUESTIONS_MIN = 0;
const QUESTION_INDEX_MIN = 0;
const TIME_TAKEN_MIN = 0;
const POINTS_MIN = 0;

const MAX_PLAYERS_MIN = 1;
const MAX_PLAYERS_MAX = 200;

const PAGINATION_PAGE_MIN = 1;
const PAGINATION_PAGE_DEFAULT = 1;

const PAGINATION_LIMIT_MIN = 1;
const PAGINATION_LIMIT_MAX = 100;
const PAGINATION_LIMIT_DEFAULT = 10;

const SORT_FIELD_CREATED_AT = 'created_at';
const SORT_FIELD_UPDATED_AT = 'updated_at';
const SORT_FIELD_STARTED_AT = 'started_at';
const SORT_FIELD_ENDED_AT = 'ended_at';

const SORT_ORDER_ASC = 'asc';
const SORT_ORDER_DESC = 'desc';

const ERROR_MESSAGES = {
  INVALID_GAME_ID: 'Invalid game ID',
  INVALID_QUIZ_SET_ID: 'Invalid quiz set ID',
  TOTAL_QUESTIONS_MUST_BE_NON_NEGATIVE: 'Total questions must be non-negative',
  GAME_CODE_MUST_BE_EXACTLY_10_CHARACTERS: 'Game code must be exactly 10 characters',
  GAME_CODE_MUST_CONTAIN_ONLY_UPPERCASE_LETTERS_AND_NUMBERS:
    'Game code must contain only uppercase letters and numbers',
  PLAYER_NAME_REQUIRED: 'Player name is required',
  PLAYER_NAME_TOO_LONG: 'Player name too long',
  ANSWER_REQUIRED: 'Answer is required',
  TIME_TAKEN_CANNOT_BE_NEGATIVE: 'Time taken cannot be negative',
  INVALID_PLAYER_ID: 'Invalid player ID',
  INVALID_QUESTION_ID: 'Invalid question ID',
} as const;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
/**
 * Enum: GameStatus
 * Description:
 * - Represents the current state of a game
 * - Lifecycle: WAITING → ACTIVE → PAUSED/FINISHED
 */
export enum GameStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  FINISHED = 'finished',
}

/**
 * Interface: Game
 * Description:
 * - Core game data structure
 * - Tracks game state, settings, timing, and player count
 * - Links to quiz set and user who created it
 */
export interface Game {
  id: string;
  quiz_set_id: string;
  game_code: string;
  current_players: number;
  status: GameStatus;
  current_question_index: number;
  current_question_start_time: string | null;
  game_settings: GameSettings;
  locked: boolean;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  paused_at: string | null;
  resumed_at: string | null;
  ended_at: string | null;
  user_id: string | null;
}

/**
 * Interface: Player
 * Description:
 * - Player record within a game
 * - Tracks player identity, device, and role (host/player)
 */
export interface Player {
  id: string;
  device_id: string | null;
  game_id: string;
  player_name: string;
  is_logged_in: boolean;
  is_host: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Interface: GameFlow
 * Description:
 * - Tracks game progression through questions
 * - Manages current and next question references
 * - Records question timing for game flow control
 */
export interface GameFlow {
  id: string;
  game_id: string;
  quiz_set_id: string;
  total_questions: number;
  current_question_id: string | null;
  next_question_id: string | null;
  current_question_index: number;
  current_question_start_time: string | null;
  current_question_end_time: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Interface: GamePlayerData
 * Description:
 * - Player performance data for a game
 * - Tracks score and answer report for leaderboard
 */
export interface GamePlayerData {
  id: string;
  player_id: string;
  player_device_id: string;
  game_id: string;
  score: number;
  answer_report: AnswerReport;
  created_at: string;
  updated_at: string;
}

/**
 * Interface: GameSettings
 * Description:
 * - Game configuration and display options
 * - Controls bonus features, answer visibility, and player limits
 */
export interface GameSettings {
  show_question_only?: boolean;
  show_explanation?: boolean;
  time_bonus?: boolean;
  streak_bonus?: boolean;
  show_correct_answer?: boolean;
  max_players?: number;
  [key: string]: unknown;
}

/**
 * Interface: AnswerReport
 * Description:
 * - Indexed collection of question answers
 * - Keyed by question ID for efficient lookup
 */
export interface AnswerReport {
  [questionId: string]: QuestionAnswer;
}

/**
 * Interface: QuestionAnswer
 * Description:
 * - Answer data for a single question
 * - Tracks correctness, timing, points, and timestamp
 */
export interface QuestionAnswer {
  answer: string;
  is_correct: boolean;
  time_taken: number;
  points_earned: number;
  answered_at: string;
}

/**
 * Interface: GameWithPlayers
 * Description:
 * - Game extended with player list
 * - Used for displaying game with all participants
 */
export interface GameWithPlayers extends Game {
  players: Player[];
}

/**
 * Interface: GameWithFlow
 * Description:
 * - Game extended with flow information
 * - Used for active games with question progression
 */
export interface GameWithFlow extends Game {
  flow: GameFlow | null;
}

/**
 * Interface: GameComplete
 * Description:
 * - Complete game data with all related entities
 * - Includes players, flow, and player data for full game state
 */
export interface GameComplete extends Game {
  players: Player[];
  flow: GameFlow | null;
  player_data: GamePlayerData[];
}

/**
 * Interface: PlayerWithData
 * Description:
 * - Player extended with performance data
 * - Used for displaying player with their game statistics
 */
export interface PlayerWithData extends Player {
  player_data: GamePlayerData | null;
}

/**
 * Interface: LeaderboardEntry
 * Description:
 * - Single entry in game leaderboard
 * - Includes player info, score, and rank
 */
export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  score: number;
  rank: number;
}

/**
 * Interface: GameLeaderboard
 * Description:
 * - Complete leaderboard structure for a game
 * - Includes game identification and all entries
 */
export interface GameLeaderboard {
  game_id: string;
  game_code: string;
  entries: LeaderboardEntry[];
  total_players: number;
}

/**
 * Interface: CreateGameRequest
 * Description:
 * - Request payload for creating a new game
 * - Requires quiz_set_id, optional game_settings and player_name
 */
export interface CreateGameRequest {
  quiz_set_id: string;
  game_settings?: Partial<GameSettings>;
  player_name?: string;
}

/**
 * Interface: JoinGameRequest
 * Description:
 * - Request payload for joining a game
 * - Requires game_code and player_name, optional device_id
 */
export interface JoinGameRequest {
  game_code: string;
  player_name: string;
  device_id?: string;
}

/**
 * Interface: StartGameRequest
 * Description:
 * - Request payload for starting a game
 * - Requires game_id, optional device_id for host verification
 */
export interface StartGameRequest {
  game_id: string;
  device_id?: string;
}

/**
 * Interface: AnswerQuestionRequest
 * Description:
 * - Request payload for submitting an answer
 * - Requires game_id, player_id, question_id, answer, and time_taken
 */
export interface AnswerQuestionRequest {
  game_id: string;
  player_id: string;
  question_id: string;
  answer: string;
  time_taken: number;
  device_id?: string;
}

/**
 * Interface: NextQuestionRequest
 * Description:
 * - Request payload for advancing to next question
 * - Requires game_id, optional device_id for host verification
 */
export interface NextQuestionRequest {
  game_id: string;
  device_id?: string;
}

/**
 * Interface: PauseResumeGameRequest
 * Description:
 * - Request payload for pausing or resuming a game
 * - Requires game_id, optional device_id for host verification
 */
export interface PauseResumeGameRequest {
  game_id: string;
  device_id?: string;
}

/**
 * Interface: EndGameRequest
 * Description:
 * - Request payload for ending a game
 * - Requires game_id, optional device_id for host verification
 */
export interface EndGameRequest {
  game_id: string;
  device_id?: string;
}

/**
 * Interface: UpdateGameSettingsRequest
 * Description:
 * - Request payload for updating game settings
 * - Requires game_id and game_settings, optional device_id
 */
export interface UpdateGameSettingsRequest {
  game_id: string;
  game_settings: Partial<GameSettings>;
  device_id?: string;
}

/**
 * Interface: LockUnlockGameRequest
 * Description:
 * - Request payload for locking or unlocking a game
 * - Requires game_id and locked flag, optional device_id
 */
export interface LockUnlockGameRequest {
  game_id: string;
  locked: boolean;
  device_id?: string;
}

/**
 * Interface: KickPlayerRequest
 * Description:
 * - Request payload for kicking a player from game
 * - Requires game_id and player_id, optional device_id
 */
export interface KickPlayerRequest {
  game_id: string;
  player_id: string;
  device_id?: string;
}

/**
 * Interface: CreateGameResponse
 * Description:
 * - Response structure for game creation
 * - Includes created game and host player
 */
export interface CreateGameResponse {
  game: Game;
  host_player: Player;
  message: string;
}

/**
 * Interface: JoinGameResponse
 * Description:
 * - Response structure for joining a game
 * - Includes game, created player, and current player count
 */
export interface JoinGameResponse {
  game: Game;
  player: Player;
  players_count: number;
  message: string;
}

/**
 * Interface: StartGameResponse
 * Description:
 * - Response structure for starting a game
 * - Includes updated game and initialized flow
 */
export interface StartGameResponse {
  game: Game;
  flow: GameFlow;
  message: string;
}

/**
 * Interface: GameStateResponse
 * Description:
 * - Complete game state for client synchronization
 * - Includes game, flow, players, and host status
 */
export interface GameStateResponse {
  game: Game;
  flow: GameFlow | null;
  players: Player[];
  current_player_count: number;
  is_host: boolean;
}

/**
 * Interface: AnswerSubmissionResponse
 * Description:
 * - Response structure for answer submission
 * - Includes player data update and correctness info
 */
export interface AnswerSubmissionResponse {
  player_data: GamePlayerData;
  is_correct: boolean;
  points_earned: number;
  current_score: number;
  message: string;
}

/**
 * Interface: NextQuestionResponse
 * Description:
 * - Response structure for advancing to next question
 * - Includes updated game, flow, and question progress
 */
export interface NextQuestionResponse {
  game: Game;
  flow: GameFlow;
  question_index: number;
  total_questions: number;
  message: string;
}

/**
 * Interface: EndGameResponse
 * Description:
 * - Response structure for ending a game
 * - Includes final game state and leaderboard
 */
export interface EndGameResponse {
  game: Game;
  leaderboard: LeaderboardEntry[];
  message: string;
}

/**
 * Interface: GameCodeValidationResponse
 * Description:
 * - Response structure for game code validation
 * - Includes validation status, game info, and capacity
 */
export interface GameCodeValidationResponse {
  game_code: string;
  is_valid: boolean;
  game_id: string | null;
  game_status: GameStatus | null;
  is_locked: boolean;
  current_players: number;
  max_players: number;
  message: string;
}

/**
 * Schema: GameStatusSchema
 * Description:
 * - Validation schema for GameStatus enum
 */
export const GameStatusSchema = z.nativeEnum(GameStatus);

/**
 * Schema: CreateGameFlowSchema
 * Description:
 * - Validation schema for creating game flow
 * - Validates game ID (UUID), quiz set ID (UUID), total questions (non-negative)
 */
export const CreateGameFlowSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  quiz_set_id: z.string().uuid(ERROR_MESSAGES.INVALID_QUIZ_SET_ID),
  total_questions: z
    .number()
    .int()
    .min(TOTAL_QUESTIONS_MIN, ERROR_MESSAGES.TOTAL_QUESTIONS_MUST_BE_NON_NEGATIVE),
  current_question_index: z.number().int().min(QUESTION_INDEX_MIN).optional(),
  current_question_id: z.string().uuid().nullable().optional(),
  next_question_id: z.string().uuid().nullable().optional(),
});

/**
 * Schema: GameSettingsSchema
 * Description:
 * - Validation schema for game settings
 * - Validates max_players (1-200) and boolean flags
 * - Uses passthrough to allow additional properties
 */
export const GameSettingsSchema = z
  .object({
    show_question_only: z.boolean().optional(),
    show_explanation: z.boolean().optional(),
    time_bonus: z.boolean().optional(),
    streak_bonus: z.boolean().optional(),
    show_correct_answer: z.boolean().optional(),
    max_players: z.number().int().min(MAX_PLAYERS_MIN).max(MAX_PLAYERS_MAX).optional(),
  })
  .passthrough();

/**
 * Schema: QuestionAnswerSchema
 * Description:
 * - Validation schema for a single question answer
 * - Validates answer text, correctness, timing, and points
 */
export const QuestionAnswerSchema = z.object({
  answer: z.string(),
  is_correct: z.boolean(),
  time_taken: z.number().int().min(TIME_TAKEN_MIN),
  points_earned: z.number().int().min(POINTS_MIN),
  answered_at: z.string(),
});

/**
 * Schema: AnswerReportSchema
 * Description:
 * - Validation schema for answer report
 * - Record of question IDs to QuestionAnswer objects
 */
export const AnswerReportSchema = z.record(z.string(), QuestionAnswerSchema);

/**
 * Schema: CreateGameSchema
 * Description:
 * - Validation schema for creating a game
 * - Validates quiz_set_id (UUID), optional player_name (1-100 chars), optional device_id (UUID)
 */
export const CreateGameSchema = z.object({
  quiz_set_id: z.string().uuid(ERROR_MESSAGES.INVALID_QUIZ_SET_ID),
  game_settings: GameSettingsSchema.optional(),
  player_name: z.string().min(STRING_MIN_LENGTH).max(PLAYER_NAME_MAX_LENGTH).optional(),
  device_id: z.string().uuid().optional(),
});

/**
 * Schema: JoinGameSchema
 * Description:
 * - Validation schema for joining a game
 * - Validates game_code (exactly 10 chars, uppercase alphanumeric), player_name (1-100 chars)
 */
export const JoinGameSchema = z.object({
  game_code: z
    .string()
    .length(GAME_CODE_LENGTH, ERROR_MESSAGES.GAME_CODE_MUST_BE_EXACTLY_10_CHARACTERS)
    .regex(
      GAME_CODE_PATTERN,
      ERROR_MESSAGES.GAME_CODE_MUST_CONTAIN_ONLY_UPPERCASE_LETTERS_AND_NUMBERS,
    ),
  player_name: z
    .string()
    .min(STRING_MIN_LENGTH, ERROR_MESSAGES.PLAYER_NAME_REQUIRED)
    .max(PLAYER_NAME_MAX_LENGTH, ERROR_MESSAGES.PLAYER_NAME_TOO_LONG),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: StartGameSchema
 * Description:
 * - Validation schema for starting a game
 * - Validates game_id (UUID), optional device_id (max 100 chars)
 */
export const StartGameSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: AnswerQuestionSchema
 * Description:
 * - Validation schema for submitting an answer
 * - Validates game_id, player_id, question_id (UUIDs), answer (min 1 char), time_taken (non-negative)
 */
export const AnswerQuestionSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  player_id: z.string().uuid(ERROR_MESSAGES.INVALID_PLAYER_ID),
  question_id: z.string().uuid(ERROR_MESSAGES.INVALID_QUESTION_ID),
  answer: z.string().min(STRING_MIN_LENGTH, ERROR_MESSAGES.ANSWER_REQUIRED),
  time_taken: z.number().int().min(TIME_TAKEN_MIN, ERROR_MESSAGES.TIME_TAKEN_CANNOT_BE_NEGATIVE),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: NextQuestionSchema
 * Description:
 * - Validation schema for advancing to next question
 * - Validates game_id (UUID), optional device_id (max 100 chars)
 */
export const NextQuestionSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: PauseResumeGameSchema
 * Description:
 * - Validation schema for pausing or resuming a game
 * - Validates game_id (UUID), optional device_id (max 100 chars)
 */
export const PauseResumeGameSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: EndGameSchema
 * Description:
 * - Validation schema for ending a game
 * - Validates game_id (UUID), optional device_id (max 100 chars)
 */
export const EndGameSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: UpdateGameSettingsSchema
 * Description:
 * - Validation schema for updating game settings
 * - Validates game_id (UUID), game_settings, optional device_id (max 100 chars)
 */
export const UpdateGameSettingsSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  game_settings: GameSettingsSchema,
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: LockUnlockGameSchema
 * Description:
 * - Validation schema for locking or unlocking a game
 * - Validates game_id (UUID), locked (boolean), optional device_id (max 100 chars)
 */
export const LockUnlockGameSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  locked: z.boolean(),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: KickPlayerSchema
 * Description:
 * - Validation schema for kicking a player
 * - Validates game_id and player_id (UUIDs), optional device_id (max 100 chars)
 */
export const KickPlayerSchema = z.object({
  game_id: z.string().uuid(ERROR_MESSAGES.INVALID_GAME_ID),
  player_id: z.string().uuid(ERROR_MESSAGES.INVALID_PLAYER_ID),
  device_id: z.string().max(DEVICE_ID_MAX_LENGTH).optional(),
});

/**
 * Schema: GameCodeValidationSchema
 * Description:
 * - Validation schema for game code validation
 * - Validates game_code (exactly 10 chars, uppercase alphanumeric)
 */
export const GameCodeValidationSchema = z.object({
  game_code: z
    .string()
    .length(GAME_CODE_LENGTH, ERROR_MESSAGES.GAME_CODE_MUST_BE_EXACTLY_10_CHARACTERS)
    .regex(
      GAME_CODE_PATTERN,
      ERROR_MESSAGES.GAME_CODE_MUST_CONTAIN_ONLY_UPPERCASE_LETTERS_AND_NUMBERS,
    ),
});

/**
 * Interface: GameQueryParams
 * Description:
 * - Query parameters for filtering and paginating games
 * - Supports filtering by status, user_id, quiz_set_id
 */
export interface GameQueryParams {
  status?: GameStatus;
  user_id?: string;
  quiz_set_id?: string;
  page?: number;
  limit?: number;
  sort_by?:
    | typeof SORT_FIELD_CREATED_AT
    | typeof SORT_FIELD_UPDATED_AT
    | typeof SORT_FIELD_STARTED_AT
    | typeof SORT_FIELD_ENDED_AT;
  sort_order?: typeof SORT_ORDER_ASC | typeof SORT_ORDER_DESC;
}

/**
 * Schema: GameQuerySchema
 * Description:
 * - Validation schema for game query parameters
 * - Validates pagination (page min 1, limit 1-100, default 10)
 * - Validates sort fields and orders
 */
export const GameQuerySchema = z.object({
  status: GameStatusSchema.optional(),
  user_id: z.string().uuid().optional(),
  quiz_set_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(PAGINATION_PAGE_MIN).default(PAGINATION_PAGE_DEFAULT),
  limit: z.coerce
    .number()
    .int()
    .min(PAGINATION_LIMIT_MIN)
    .max(PAGINATION_LIMIT_MAX)
    .default(PAGINATION_LIMIT_DEFAULT),
  sort_by: z
    .enum([
      SORT_FIELD_CREATED_AT,
      SORT_FIELD_UPDATED_AT,
      SORT_FIELD_STARTED_AT,
      SORT_FIELD_ENDED_AT,
    ])
    .default(SORT_FIELD_CREATED_AT),
  sort_order: z.enum([SORT_ORDER_ASC, SORT_ORDER_DESC]).default(SORT_ORDER_DESC),
});

/**
 * Interface: PaginatedGameResponse
 * Description:
 * - Generic paginated response structure for games
 * - Includes data array and pagination metadata
 */
export interface PaginatedGameResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

/**
 * Interface: GameError
 * Description:
 * - Standard error response structure for game operations
 * - Includes error code, message, and optional error code
 */
export interface GameError {
  error: string;
  message: string;
  code?: string;
}

/**
 * Interface: ServerGameCreatedPayload
 * Description:
 * - Socket.IO server event payload for game creation
 * - Broadcast to all connected clients when game is created
 */
export interface ServerGameCreatedPayload {
  game: Game;
  host_player: Player;
}

/**
 * Interface: ServerPlayerJoinedPayload
 * Description:
 * - Socket.IO server event payload for player joining
 * - Broadcast to all players in the game
 */
export interface ServerPlayerJoinedPayload {
  player: Player;
  current_players: number;
}

/**
 * Interface: ServerPlayerLeftPayload
 * Description:
 * - Socket.IO server event payload for player leaving
 * - Broadcast to all players in the game
 */
export interface ServerPlayerLeftPayload {
  player_id: string;
  player_name: string;
  current_players: number;
}

/**
 * Interface: ServerGameStartedPayload
 * Description:
 * - Socket.IO server event payload for game start
 * - Broadcast to all players when game begins
 */
export interface ServerGameStartedPayload {
  game: Game;
  flow: GameFlow;
}

/**
 * Interface: ServerQuestionStartedPayload
 * Description:
 * - Socket.IO server event payload for question start
 * - Broadcast to all players when new question begins
 */
export interface ServerQuestionStartedPayload {
  game: Game;
  flow: GameFlow;
  question_index: number;
  total_questions: number;
}

/**
 * Interface: ServerPlayerAnsweredPayload
 * Description:
 * - Socket.IO server event payload for player answer
 * - Broadcast to all players when someone answers
 */
export interface ServerPlayerAnsweredPayload {
  player_id: string;
  player_name: string;
  answered_count: number;
  total_players: number;
}

/**
 * Interface: ServerGamePausedPayload
 * Description:
 * - Socket.IO server event payload for game pause
 * - Broadcast to all players when game is paused
 */
export interface ServerGamePausedPayload {
  game: Game;
  paused_by: string;
}

/**
 * Interface: ServerGameResumedPayload
 * Description:
 * - Socket.IO server event payload for game resume
 * - Broadcast to all players when game resumes
 */
export interface ServerGameResumedPayload {
  game: Game;
  resumed_by: string;
}

/**
 * Interface: ServerGameEndedPayload
 * Description:
 * - Socket.IO server event payload for game end
 * - Broadcast to all players with final leaderboard
 */
export interface ServerGameEndedPayload {
  game: Game;
  leaderboard: LeaderboardEntry[];
}

/**
 * Interface: ServerGameLockedPayload
 * Description:
 * - Socket.IO server event payload for game lock/unlock
 * - Broadcast to all players when game lock status changes
 */
export interface ServerGameLockedPayload {
  game: Game;
  locked: boolean;
}

/**
 * Interface: ServerPlayerKickedPayload
 * Description:
 * - Socket.IO server event payload for player kick
 * - Broadcast to all players when someone is kicked
 */
export interface ServerPlayerKickedPayload {
  player_id: string;
  player_name: string;
  kicked_by: string;
}

/**
 * Interface: ServerGameErrorPayload
 * Description:
 * - Socket.IO server event payload for game errors
 * - Broadcast to affected clients on error
 */
export interface ServerGameErrorPayload {
  error: string;
  message: string;
}

/**
 * Interface: ClientJoinGamePayload
 * Description:
 * - Socket.IO client event payload for joining game
 * - Sent from client to server
 */
export interface ClientJoinGamePayload {
  game_code: string;
  player_name: string;
  device_id?: string;
}

/**
 * Interface: ClientLeaveGamePayload
 * Description:
 * - Socket.IO client event payload for leaving game
 * - Sent from client to server
 */
export interface ClientLeaveGamePayload {
  game_id: string;
  player_id: string;
}

/**
 * Interface: ClientStartGamePayload
 * Description:
 * - Socket.IO client event payload for starting game
 * - Sent from host client to server
 */
export interface ClientStartGamePayload {
  game_id: string;
  device_id?: string;
}

/**
 * Interface: ClientAnswerQuestionPayload
 * Description:
 * - Socket.IO client event payload for answering question
 * - Sent from player client to server
 */
export interface ClientAnswerQuestionPayload {
  game_id: string;
  player_id: string;
  question_id: string;
  answer: string;
  time_taken: number;
  device_id?: string;
}

/**
 * Interface: ClientNextQuestionPayload
 * Description:
 * - Socket.IO client event payload for next question
 * - Sent from host client to server
 */
export interface ClientNextQuestionPayload {
  game_id: string;
  device_id?: string;
}

/**
 * Interface: ClientPauseGamePayload
 * Description:
 * - Socket.IO client event payload for pausing game
 * - Sent from host client to server
 */
export interface ClientPauseGamePayload {
  game_id: string;
  device_id?: string;
}

/**
 * Interface: ClientResumeGamePayload
 * Description:
 * - Socket.IO client event payload for resuming game
 * - Sent from host client to server
 */
export interface ClientResumeGamePayload {
  game_id: string;
  device_id?: string;
}

/**
 * Interface: ClientEndGamePayload
 * Description:
 * - Socket.IO client event payload for ending game
 * - Sent from host client to server
 */
export interface ClientEndGamePayload {
  game_id: string;
  device_id?: string;
}

/**
 * Type: CreateGameInput
 * Description:
 * - Inferred type from CreateGameSchema
 * - Represents validated input for creating a game
 */
export type CreateGameInput = z.infer<typeof CreateGameSchema>;

/**
 * Type: JoinGameInput
 * Description:
 * - Inferred type from JoinGameSchema
 * - Represents validated input for joining a game
 */
export type JoinGameInput = z.infer<typeof JoinGameSchema>;

/**
 * Type: StartGameInput
 * Description:
 * - Inferred type from StartGameSchema
 * - Represents validated input for starting a game
 */
export type StartGameInput = z.infer<typeof StartGameSchema>;

/**
 * Type: AnswerQuestionInput
 * Description:
 * - Inferred type from AnswerQuestionSchema
 * - Represents validated input for answering a question
 */
export type AnswerQuestionInput = z.infer<typeof AnswerQuestionSchema>;

/**
 * Type: NextQuestionInput
 * Description:
 * - Inferred type from NextQuestionSchema
 * - Represents validated input for advancing to next question
 */
export type NextQuestionInput = z.infer<typeof NextQuestionSchema>;

/**
 * Type: PauseResumeGameInput
 * Description:
 * - Inferred type from PauseResumeGameSchema
 * - Represents validated input for pausing or resuming a game
 */
export type PauseResumeGameInput = z.infer<typeof PauseResumeGameSchema>;

/**
 * Type: EndGameInput
 * Description:
 * - Inferred type from EndGameSchema
 * - Represents validated input for ending a game
 */
export type EndGameInput = z.infer<typeof EndGameSchema>;

/**
 * Type: UpdateGameSettingsInput
 * Description:
 * - Inferred type from UpdateGameSettingsSchema
 * - Represents validated input for updating game settings
 */
export type UpdateGameSettingsInput = z.infer<typeof UpdateGameSettingsSchema>;

/**
 * Type: LockUnlockGameInput
 * Description:
 * - Inferred type from LockUnlockGameSchema
 * - Represents validated input for locking or unlocking a game
 */
export type LockUnlockGameInput = z.infer<typeof LockUnlockGameSchema>;

/**
 * Type: KickPlayerInput
 * Description:
 * - Inferred type from KickPlayerSchema
 * - Represents validated input for kicking a player
 */
export type KickPlayerInput = z.infer<typeof KickPlayerSchema>;

/**
 * Type: GameCodeValidationInput
 * Description:
 * - Inferred type from GameCodeValidationSchema
 * - Represents validated input for game code validation
 */
export type GameCodeValidationInput = z.infer<typeof GameCodeValidationSchema>;

/**
 * Type: GameInsert
 * Description:
 * - Database insert type for Game
 * - Omits auto-generated and computed fields
 */
export type GameInsert = Omit<
  Game,
  'id' | 'created_at' | 'updated_at' | 'current_players' | 'current_question_index'
>;

/**
 * Type: PlayerInsert
 * Description:
 * - Database insert type for Player
 * - Omits auto-generated fields
 */
export type PlayerInsert = Omit<Player, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type: GameFlowInsert
 * Description:
 * - Database insert type for GameFlow
 * - Omits auto-generated fields
 */
export type GameFlowInsert = Omit<GameFlow, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type: GamePlayerDataInsert
 * Description:
 * - Database insert type for GamePlayerData
 * - Omits auto-generated fields
 */
export type GamePlayerDataInsert = Omit<GamePlayerData, 'id' | 'created_at' | 'updated_at'>;

/**
 * Type: GameUpdate
 * Description:
 * - Database update type for Game
 * - Partial type excluding immutable fields
 */
export type GameUpdate = Partial<Omit<Game, 'id' | 'created_at'>>;

/**
 * Type: PlayerUpdate
 * Description:
 * - Database update type for Player
 * - Partial type excluding immutable fields
 */
export type PlayerUpdate = Partial<Omit<Player, 'id' | 'created_at' | 'game_id'>>;

/**
 * Type: GameFlowUpdate
 * Description:
 * - Database update type for GameFlow
 * - Partial type excluding immutable fields
 */
export type GameFlowUpdate = Partial<Omit<GameFlow, 'id' | 'created_at' | 'game_id'>>;

/**
 * Type: GamePlayerDataUpdate
 * Description:
 * - Database update type for GamePlayerData
 * - Partial type excluding immutable fields
 */
export type GamePlayerDataUpdate = Partial<
  Omit<GamePlayerData, 'id' | 'created_at' | 'player_id' | 'game_id'>
>;
