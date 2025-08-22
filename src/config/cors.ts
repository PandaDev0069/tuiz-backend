// src/config/cors.ts
import cors from 'cors';
import { getAllowedOrigins } from './env';

function originAllowed(origin: string, allowedList: string[]): boolean {
  // Exact match
  if (allowedList.includes(origin)) return true;

  for (const a of allowedList) {
    if (!a) continue;
    // global wildcard
    if (a === '*') return true;
    // suffix wildcard: *.vercel.app -> allow any origin that endsWith('.vercel.app')
    if (a.startsWith('*.') && origin.endsWith(a.slice(1))) return true;
    // prefix wildcard: https://staging-* -> allow startsWith
    if (a.endsWith('*') && origin.startsWith(a.slice(0, -1))) return true;
  }

  return false;
}

export const corsMw = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow curl/local or same-origin server requests
    const allowed = getAllowedOrigins();
    if (originAllowed(origin, allowed)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
});
