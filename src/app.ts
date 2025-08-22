// src/app.ts
import express from 'express';
import { corsMw } from './config/cors';
import { errorMw } from './middleware/error';
import authRoutes from './routes/auth';
import health from './routes/health';

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

  // 404 → unified error contract
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found' });
  });

  // centralized errors
  app.use(errorMw);

  return app;
}
