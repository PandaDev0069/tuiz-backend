// src/config/cors.ts
import cors from 'cors';
import { getAllowedOrigins } from './env';

function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin.replace(/^https?:\/\//i, '').split(':')[0]; // crude fallback
  }
}

function originAllowed(origin: string, allowedList: string[]): boolean {
  const host = hostnameOf(origin);

  // In development, allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  if (process.env.NODE_ENV !== 'production') {
    const localNetworkPatterns = [
      /^192\.168\.\d{1,3}\.\d{1,3}$/, // 192.168.x.x
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 10.x.x.x
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16-31.x.x
      'localhost',
      '127.0.0.1',
    ];

    for (const pattern of localNetworkPatterns) {
      if (typeof pattern === 'string' && host === pattern) {
        return true;
      }
      if (pattern instanceof RegExp && pattern.test(host)) {
        return true;
      }
    }
  }

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

    if (originAllowed(origin, allowed)) {
      return cb(null, true);
    }

    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Request-Id'],
  optionsSuccessStatus: 204,
});
