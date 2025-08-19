// src/server.ts
import http from 'http';
import { createApp } from './app';
import { env, isProd } from './config/env';
import { logger } from './utils/logger';

const app = createApp();
const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info(`api listening on http://localhost:${env.PORT} (${isProd ? 'prod' : 'dev'})`);
});
