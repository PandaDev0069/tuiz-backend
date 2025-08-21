// src/server.ts
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { env, isProd } from './config/env';
import { logger } from './utils/logger';

const app = createApp();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
  },
});

io.on('connection', (socket) => {
  logger.info('socket.io connected');
  socket.emit('server:hello');
  socket.on('client:hello', () => {
    logger.info('client greeted');
  });
});

server.listen(env.PORT, () => {
  logger.info(`api listening on http://localhost:${env.PORT} (${isProd ? 'prod' : 'dev'})`);
});
