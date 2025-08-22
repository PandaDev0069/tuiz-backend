// src/config/cors.ts
import cors from 'cors';
import { getAllowedOrigins, isProd } from './env';

// Logger function to avoid ESLint console statement errors
const log = (message: string, ...args: unknown[]) => {
  if (isProd) {
    // eslint-disable-next-line no-console
    console.log(message, ...args);
  }
};

function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin.replace(/^https?:\/\//i, '').split(':')[0]; // crude fallback
  }
}

function originAllowed(origin: string, allowedList: string[]): boolean {
  const host = hostnameOf(origin);

  for (const a of allowedList) {
    if (!a) continue;
    if (a === '*') return true;

    // Exact full origin match (scheme + host)
    if (/^https?:\/\//i.test(a) && origin === a) return true;

    // Exact host match
    if (!a.includes('*') && host === hostnameOf(a)) return true;

    // Wildcard suffix: *.vercel.app
    if (a.startsWith('*.') && host.endsWith(a.slice(2))) return true;

    // Wildcard prefix: staging-* (hostname starts with "staging-")
    if (a.endsWith('*') && host.startsWith(a.slice(0, -1))) return true;
  }

  return false;
}

export const corsMw = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / same-origin

    const allowed = getAllowedOrigins();

    // Add logging for debugging in production
    if (isProd) {
      log(`[CORS] Checking origin: ${origin}`);
      log(`[CORS] Allowed origins:`, allowed);
    }

    if (originAllowed(origin, allowed)) {
      if (isProd) {
        log(`[CORS] Origin ${origin} allowed`);
      }
      return cb(null, true);
    }

    // Log the blocked request for debugging
    if (isProd) {
      log(`[CORS] Origin ${origin} blocked`);
      log(`[CORS] Hostname: ${hostnameOf(origin)}`);
      log(`[CORS] Allowed patterns:`, allowed);
    }

    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  optionsSuccessStatus: 204,
});
