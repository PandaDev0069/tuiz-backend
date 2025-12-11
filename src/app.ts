// src/app.ts
import express from 'express';
import { corsMw } from './config/cors';
import { authMiddleware } from './middleware/auth';
import { errorMw } from './middleware/error';
import answerRoutes from './routes/answers';
import authRoutes from './routes/auth';
import codeRoutes from './routes/codes';
import gameEventRoutes from './routes/game-events';
import gamePlayerDataRoutes from './routes/game-player-data';
import gameRoutes from './routes/games';
import health from './routes/health';
import playerRoutes from './routes/players';
import profileRoutes from './routes/profile';
import publishingRoutes from './routes/publishing';
import questionRoutes from './routes/questions';
import quizRoutes from './routes/quiz';
import quizLibraryRoutes from './routes/quiz-library';
import uploadRoutes from './routes/upload';
import { AuthenticatedRequest } from './types/auth';

export function createApp() {
  const app = express();

  // core middleware
  app.use(corsMw);
  app.use(express.json());

  // welcome route
  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to TUIZ Backend API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  // routes
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
  app.use('/games', gameEventRoutes);
  app.use('/games', playerRoutes);
  app.use('/games', gamePlayerDataRoutes);
  app.use(playerRoutes);

  // Example protected route - add your protected routes here
  app.get('/protected', authMiddleware, (req: AuthenticatedRequest, res) => {
    res.json({
      message: 'This is a protected route',
      user: req.user,
    });
  });

  // 404 → unified error contract
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found' });
  });

  // centralized errors
  app.use(errorMw);

  return app;
}
