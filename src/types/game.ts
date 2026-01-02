// src/types/game.ts
import { z } from 'zod';

// ============================================================================
// ENUMS (matching database)
// ============================================================================

export enum GameStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  FINISHED = 'finished',
}

// ============================================================================
// CORE INTERFACES (matching database schema)
// ============================================================================

export interface Game {
  id: string;
  quiz_set_id: string;
  game_code: string;
  current_players: number;
  status: GameStatus;
  current_question_index: number;
  current_question_start_time: string | null; // ISO-8601 timestamp
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

// ============================================================================
// NESTED INTERFACES
// ============================================================================

export interface GameSettings {
  show_question_only?: boolean;
  show_explanation?: boolean;
  time_bonus?: boolean;
  streak_bonus?: boolean;
  show_correct_answer?: boolean;
  max_players?: number;
  [key: string]: unknown; // Allow additional settings
}

export interface AnswerReport {
  [questionId: string]: QuestionAnswer;
}

export interface QuestionAnswer {
  answer: string;
  is_correct: boolean;
  time_taken: number; // milliseconds
  points_earned: number;
  answered_at: string;
}

// ============================================================================
// EXTENDED INTERFACES
// ============================================================================

export interface GameWithPlayers extends Game {
  players: Player[];
}

export interface GameWithFlow extends Game {
  flow: GameFlow | null;
}

export interface GameComplete extends Game {
  players: Player[];
  flow: GameFlow | null;
  player_data: GamePlayerData[];
}

export interface PlayerWithData extends Player {
  player_data: GamePlayerData | null;
}

// ============================================================================
// LEADERBOARD INTERFACES
// ============================================================================

export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  score: number;
  rank: number;
}

export interface GameLeaderboard {
  game_id: string;
  game_code: string;
  entries: LeaderboardEntry[];
  total_players: number;
}

// ============================================================================
// REQUEST INTERFACES
// ============================================================================

// Create Game Request
export interface CreateGameRequest {
  quiz_set_id: string;
  game_settings?: Partial<GameSettings>;
  player_name?: string; // Host player name
}

// Join Game Request
export interface JoinGameRequest {
  game_code: string;
  player_name: string;
  device_id?: string;
}

// Start Game Request
export interface StartGameRequest {
  game_id: string;
  device_id?: string; // Host device ID for verification
}

// Answer Question Request
export interface AnswerQuestionRequest {
  game_id: string;
  player_id: string;
  question_id: string;
  answer: string; // Answer ID or text
  time_taken: number; // milliseconds
  device_id?: string;
}

// Next Question Request
export interface NextQuestionRequest {
  game_id: string;
  device_id?: string; // Host device ID for verification
}

// Pause/Resume Game Request
export interface PauseResumeGameRequest {
  game_id: string;
  device_id?: string; // Host device ID for verification
}

// End Game Request
export interface EndGameRequest {
  game_id: string;
  device_id?: string; // Host device ID for verification
}

// Update Game Settings Request
export interface UpdateGameSettingsRequest {
  game_id: string;
  game_settings: Partial<GameSettings>;
  device_id?: string; // Host device ID for verification
}

// Lock/Unlock Game Request
export interface LockUnlockGameRequest {
  game_id: string;
  locked: boolean;
  device_id?: string; // Host device ID for verification
}

// Kick Player Request
export interface KickPlayerRequest {
  game_id: string;
  player_id: string;
  device_id?: string; // Host device ID for verification
}

// ============================================================================
// RESPONSE INTERFACES
// ============================================================================

// Create Game Response
export interface CreateGameResponse {
  game: Game;
  host_player: Player;
  message: string;
}

// Join Game Response
export interface JoinGameResponse {
  game: Game;
  player: Player;
  players_count: number;
  message: string;
}

// Start Game Response
export interface StartGameResponse {
  game: Game;
  flow: GameFlow;
  message: string;
}

// Game State Response
export interface GameStateResponse {
  game: Game;
  flow: GameFlow | null;
  players: Player[];
  current_player_count: number;
  is_host: boolean;
}

// Answer Submission Response
export interface AnswerSubmissionResponse {
  player_data: GamePlayerData;
  is_correct: boolean;
  points_earned: number;
  current_score: number;
  message: string;
}

// Next Question Response
export interface NextQuestionResponse {
  game: Game;
  flow: GameFlow;
  question_index: number;
  total_questions: number;
  message: string;
}

// End Game Response
export interface EndGameResponse {
  game: Game;
  leaderboard: LeaderboardEntry[];
  message: string;
}

// Game Code Validation Response
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

// ============================================================================
// VALIDATION SCHEMAS (Zod)
// ============================================================================

// Game Status Schema
export const GameStatusSchema = z.nativeEnum(GameStatus);

// Create Game Flow Schema
export const CreateGameFlowSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  quiz_set_id: z.string().uuid('Invalid quiz set ID'),
  total_questions: z.number().int().min(0, 'Total questions must be non-negative'),
  current_question_index: z.number().int().min(0).optional(),
  current_question_id: z.string().uuid().nullable().optional(),
  next_question_id: z.string().uuid().nullable().optional(),
});

// Game Settings Schema
export const GameSettingsSchema = z
  .object({
    show_question_only: z.boolean().optional(),
    show_explanation: z.boolean().optional(),
    time_bonus: z.boolean().optional(),
    streak_bonus: z.boolean().optional(),
    show_correct_answer: z.boolean().optional(),
    max_players: z.number().int().min(1).max(400).optional(),
  })
  .passthrough(); // Allow additional fields

// Answer Report Schema
export const QuestionAnswerSchema = z.object({
  answer: z.string(),
  is_correct: z.boolean(),
  time_taken: z.number().int().min(0),
  points_earned: z.number().int().min(0),
  answered_at: z.string(),
});

export const AnswerReportSchema = z.record(z.string(), QuestionAnswerSchema);

// Create Game Schema
export const CreateGameSchema = z.object({
  quiz_set_id: z.string().uuid('Invalid quiz set ID'),
  game_settings: GameSettingsSchema.optional(),
  player_name: z.string().min(1).max(100).optional(),
  device_id: z.string().uuid().optional(), // Host device ID for creating host player
});

// Join Game Schema
export const JoinGameSchema = z.object({
  game_code: z
    .string()
    .length(10, 'Game code must be exactly 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Game code must contain only uppercase letters and numbers'),
  player_name: z.string().min(1, 'Player name is required').max(100, 'Player name too long'),
  device_id: z.string().max(100).optional(),
});

// Start Game Schema
export const StartGameSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  device_id: z.string().max(100).optional(),
});

// Answer Question Schema
export const AnswerQuestionSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  player_id: z.string().uuid('Invalid player ID'),
  question_id: z.string().uuid('Invalid question ID'),
  answer: z.string().min(1, 'Answer is required'),
  time_taken: z.number().int().min(0, 'Time taken cannot be negative'),
  device_id: z.string().max(100).optional(),
});

// Next Question Schema
export const NextQuestionSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  device_id: z.string().max(100).optional(),
});

// Pause/Resume Game Schema
export const PauseResumeGameSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  device_id: z.string().max(100).optional(),
});

// End Game Schema
export const EndGameSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  device_id: z.string().max(100).optional(),
});

// Update Game Settings Schema
export const UpdateGameSettingsSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  game_settings: GameSettingsSchema,
  device_id: z.string().max(100).optional(),
});

// Lock/Unlock Game Schema
export const LockUnlockGameSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  locked: z.boolean(),
  device_id: z.string().max(100).optional(),
});

// Kick Player Schema
export const KickPlayerSchema = z.object({
  game_id: z.string().uuid('Invalid game ID'),
  player_id: z.string().uuid('Invalid player ID'),
  device_id: z.string().max(100).optional(),
});

// Game Code Validation Schema
export const GameCodeValidationSchema = z.object({
  game_code: z
    .string()
    .length(10, 'Game code must be exactly 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Game code must contain only uppercase letters and numbers'),
});

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

export interface GameQueryParams {
  status?: GameStatus;
  user_id?: string;
  quiz_set_id?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'started_at' | 'ended_at';
  sort_order?: 'asc' | 'desc';
}

// Query validation schema
export const GameQuerySchema = z.object({
  status: GameStatusSchema.optional(),
  user_id: z.string().uuid().optional(),
  quiz_set_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort_by: z.enum(['created_at', 'updated_at', 'started_at', 'ended_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================================
// PAGINATION
// ============================================================================

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

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface GameError {
  error: string;
  message: string;
  code?: string;
}

// ============================================================================
// SOCKET.IO EVENT PAYLOADS
// ============================================================================

// Server -> Client Events
export interface ServerGameCreatedPayload {
  game: Game;
  host_player: Player;
}

export interface ServerPlayerJoinedPayload {
  player: Player;
  current_players: number;
}

export interface ServerPlayerLeftPayload {
  player_id: string;
  player_name: string;
  current_players: number;
}

export interface ServerGameStartedPayload {
  game: Game;
  flow: GameFlow;
}

export interface ServerQuestionStartedPayload {
  game: Game;
  flow: GameFlow;
  question_index: number;
  total_questions: number;
}

export interface ServerPlayerAnsweredPayload {
  player_id: string;
  player_name: string;
  answered_count: number;
  total_players: number;
}

export interface ServerGamePausedPayload {
  game: Game;
  paused_by: string;
}

export interface ServerGameResumedPayload {
  game: Game;
  resumed_by: string;
}

export interface ServerGameEndedPayload {
  game: Game;
  leaderboard: LeaderboardEntry[];
}

export interface ServerGameLockedPayload {
  game: Game;
  locked: boolean;
}

export interface ServerPlayerKickedPayload {
  player_id: string;
  player_name: string;
  kicked_by: string;
}

export interface ServerGameErrorPayload {
  error: string;
  message: string;
}

// Client -> Server Events
export interface ClientJoinGamePayload {
  game_code: string;
  player_name: string;
  device_id?: string;
}

export interface ClientLeaveGamePayload {
  game_id: string;
  player_id: string;
}

export interface ClientStartGamePayload {
  game_id: string;
  device_id?: string;
}

export interface ClientAnswerQuestionPayload {
  game_id: string;
  player_id: string;
  question_id: string;
  answer: string;
  time_taken: number;
  device_id?: string;
}

export interface ClientNextQuestionPayload {
  game_id: string;
  device_id?: string;
}

export interface ClientPauseGamePayload {
  game_id: string;
  device_id?: string;
}

export interface ClientResumeGamePayload {
  game_id: string;
  device_id?: string;
}

export interface ClientEndGamePayload {
  game_id: string;
  device_id?: string;
}

// ============================================================================
// TYPE EXPORTS FOR VALIDATION
// ============================================================================

export type CreateGameInput = z.infer<typeof CreateGameSchema>;
export type JoinGameInput = z.infer<typeof JoinGameSchema>;
export type StartGameInput = z.infer<typeof StartGameSchema>;
export type AnswerQuestionInput = z.infer<typeof AnswerQuestionSchema>;
export type NextQuestionInput = z.infer<typeof NextQuestionSchema>;
export type PauseResumeGameInput = z.infer<typeof PauseResumeGameSchema>;
export type EndGameInput = z.infer<typeof EndGameSchema>;
export type UpdateGameSettingsInput = z.infer<typeof UpdateGameSettingsSchema>;
export type LockUnlockGameInput = z.infer<typeof LockUnlockGameSchema>;
export type KickPlayerInput = z.infer<typeof KickPlayerSchema>;
export type GameCodeValidationInput = z.infer<typeof GameCodeValidationSchema>;

// ============================================================================
// UTILITY TYPES
// ============================================================================

// Helper type for database insertions (omits auto-generated fields)
export type GameInsert = Omit<
  Game,
  'id' | 'created_at' | 'updated_at' | 'current_players' | 'current_question_index'
>;

export type PlayerInsert = Omit<Player, 'id' | 'created_at' | 'updated_at'>;

export type GameFlowInsert = Omit<GameFlow, 'id' | 'created_at' | 'updated_at'>;

export type GamePlayerDataInsert = Omit<GamePlayerData, 'id' | 'created_at' | 'updated_at'>;

// Helper type for database updates (all fields optional except id)
export type GameUpdate = Partial<Omit<Game, 'id' | 'created_at'>>;

export type PlayerUpdate = Partial<Omit<Player, 'id' | 'created_at' | 'game_id'>>;

export type GameFlowUpdate = Partial<Omit<GameFlow, 'id' | 'created_at' | 'game_id'>>;

export type GamePlayerDataUpdate = Partial<
  Omit<GamePlayerData, 'id' | 'created_at' | 'player_id' | 'game_id'>
>;
