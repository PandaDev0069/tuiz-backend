// src/config/cors.ts
import cors from 'cors';
import { getAllowedOrigins } from './env';

export const corsMw = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow curl/local
    const allowed = getAllowedOrigins();
    if (allowed.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
});
