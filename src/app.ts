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
// 2. Application Factory
//----------------------------------------------------
export function createApp() {
  const app = express();

  //----------------------------------------------------
  // 3. Core Middleware
  //----------------------------------------------------
  app.use(corsMw);
  app.use(express.json());

  //----------------------------------------------------
  // 4. Welcome Route
  //----------------------------------------------------
  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to TUIZ Backend API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  //----------------------------------------------------
  // 5. API Routes
  //----------------------------------------------------
  app.use('/auth', authRoutes);
  app.use('/health', health);
  app.use('/profile', profileRoutes);
  app.use('/upload', uploadRoutes);
  app.use('/quiz', quizRoutes);
  app.use('/quiz', questionRoutes);
  app.use('/quiz', answerRoutes);
  app.use('/quiz', publishingRoutes);
  app.use('/quiz', codeRoutes);
  app.use('/quiz-library', quizLibraryRoutes);
  app.use('/games', gameRoutes);
  app.use('/games', gameStateRoutes);
  app.use('/games', gameFlowRoutes);
  app.use('/games', gameEventRoutes);
  app.use('/games', playerRoutes);
  app.use('/games', gamePlayerDataRoutes);
  app.use('/games', roomParticipantRoutes);
  app.use('/websocket-connections', websocketConnectionRoutes);
  app.use('/device-sessions', deviceSessionRoutes);
  app.use(playerRoutes);
  app.use(roomParticipantRoutes);

  //----------------------------------------------------
  // 6. Protected Route Example
  //----------------------------------------------------
  app.get('/protected', authMiddleware, (req: AuthenticatedRequest, res) => {
    res.json({
      message: 'This is a protected route',
      user: req.user,
    });
  });

  //----------------------------------------------------
  // 7. Error Handling
  //----------------------------------------------------
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found' });
  });

  app.use(errorMw);

  return app;
}
