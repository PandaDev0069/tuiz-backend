// src/routes/health.ts
import { Router } from 'express';

const r = Router();

// Basic liveness
r.get('/', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// (Optional) readiness placeholder — extend later if you add db checks
r.get('/ready', (_req, res) => {
  res.json({ ready: true });
});

export default r;
