// ====================================================
// File Name   : app.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2025-12-11

// Description:
// - Express application factory with middleware and route configuration
// - Implements unified error contract for consistent API responses
// - Configures CORS, authentication, and all API endpoints

// Notes:
// - CORS configured via corsMw from config/cors
// - Auth middleware available for protected routes
// - Centralized error handling via errorMw
// - 404 responses follow unified error contract
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import express from 'express';
import { corsMw } from './config/cors';
import { authMiddleware } from './middleware/auth';
import { errorMw } from './middleware/error';
import answerRoutes from './routes/answers';
import authRoutes from './routes/auth';
import codeRoutes from './routes/codes';
import deviceSessionRoutes from './routes/device-sessions';
import gameEventRoutes from './routes/game-events';
import gameFlowRoutes from './routes/game-flows';
import gamePlayerDataRoutes from './routes/game-player-data';
import gameStateRoutes from './routes/game-state';
import gameRoutes from './routes/games';
import health from './routes/health';
import playerRoutes from './routes/players';
import profileRoutes from './routes/profile';
import publishingRoutes from './routes/publishing';
import questionRoutes from './routes/questions';
import quizRoutes from './routes/quiz';
import quizLibraryRoutes from './routes/quiz-library';
import roomParticipantRoutes from './routes/room-participants';
import uploadRoutes from './routes/upload';
import websocketConnectionRoutes from './routes/websocket-connections';
import { AuthenticatedRequest } from './types/auth';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const API_VERSION = '1.0.0';
const API_STATUS_RUNNING = 'running';

const WELCOME_MESSAGE = 'Welcome to TUIZ Backend API';
const PROTECTED_ROUTE_MESSAGE = 'This is a protected route';

const ERROR_NOT_FOUND = 'not_found';
const ERROR_NOT_FOUND_MESSAGE = 'Route not found';

const HTTP_STATUS_NOT_FOUND = 404;

const ROUTE_PATHS = {
  ROOT: '/',
  AUTH: '/auth',
  HEALTH: '/health',
  PROFILE: '/profile',
  UPLOAD: '/upload',
  QUIZ: '/quiz',
  QUIZ_LIBRARY: '/quiz-library',
  GAMES: '/games',
  WEBSOCKET_CONNECTIONS: '/websocket-connections',
  DEVICE_SESSIONS: '/device-sessions',
  PROTECTED: '/protected',
} as const;

//----------------------------------------------------
// 3. Core Logic
//----------------------------------------------------
/**
 * Function: createApp
 * Description:
 * - Creates and configures Express application
 * - Sets up middleware, routes, and error handling
 *
 * Returns:
 * - express.Application: Configured Express application instance
 */
export function createApp() {
  const app = express();

  app.use(corsMw);
  app.use(express.json());

  app.get(ROUTE_PATHS.ROOT, (req, res) => {
    res.json({
      message: WELCOME_MESSAGE,
      version: API_VERSION,
      status: API_STATUS_RUNNING,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(ROUTE_PATHS.AUTH, authRoutes);
  app.use(ROUTE_PATHS.HEALTH, health);
  app.use(ROUTE_PATHS.PROFILE, profileRoutes);
  app.use(ROUTE_PATHS.UPLOAD, uploadRoutes);
  app.use(ROUTE_PATHS.QUIZ, quizRoutes);
  app.use(ROUTE_PATHS.QUIZ, questionRoutes);
  app.use(ROUTE_PATHS.QUIZ, answerRoutes);
  app.use(ROUTE_PATHS.QUIZ, publishingRoutes);
  app.use(ROUTE_PATHS.QUIZ, codeRoutes);
  app.use(ROUTE_PATHS.QUIZ_LIBRARY, quizLibraryRoutes);
  app.use(ROUTE_PATHS.GAMES, gameRoutes);
  app.use(ROUTE_PATHS.GAMES, gameStateRoutes);
  app.use(ROUTE_PATHS.GAMES, gameFlowRoutes);
  app.use(ROUTE_PATHS.GAMES, gameEventRoutes);
  app.use(ROUTE_PATHS.GAMES, playerRoutes);
  app.use(ROUTE_PATHS.GAMES, gamePlayerDataRoutes);
  app.use(ROUTE_PATHS.GAMES, roomParticipantRoutes);
  app.use(ROUTE_PATHS.WEBSOCKET_CONNECTIONS, websocketConnectionRoutes);
  app.use(ROUTE_PATHS.DEVICE_SESSIONS, deviceSessionRoutes);
  app.use(playerRoutes);
  app.use(roomParticipantRoutes);

  app.get(ROUTE_PATHS.PROTECTED, authMiddleware, (req: AuthenticatedRequest, res) => {
    res.json({
      message: PROTECTED_ROUTE_MESSAGE,
      user: req.user,
    });
  });

  app.use((_req, res) => {
    res.status(HTTP_STATUS_NOT_FOUND).json({
      error: ERROR_NOT_FOUND,
      message: ERROR_NOT_FOUND_MESSAGE,
    });
  });

  app.use(errorMw);

  return app;
}
