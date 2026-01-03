// ====================================================
// File Name   : health.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2025-08-19

// Description:
// - Express routes for health check endpoints
// - Provides liveness and readiness probes for monitoring
// - Simple endpoints to verify service availability

// Notes:
// - All routes are public (no authentication required)
// - Liveness endpoint returns current timestamp
// - Readiness endpoint can be extended for database checks
// ====================================================

//----------------------------------------------------
// 1. Imports / Dependencies
//----------------------------------------------------
import { Router } from 'express';

//----------------------------------------------------
// 2. Constants / Configuration
//----------------------------------------------------
const HEALTH_STATUS_OK = true;
const READY_STATUS_READY = true;

//----------------------------------------------------
// 3. Types / Interfaces
//----------------------------------------------------
// No additional types

//----------------------------------------------------
// 4. Core Logic
//----------------------------------------------------
const router = Router();

/**
 * Route: GET /
 * Description:
 * - Basic liveness probe endpoint
 * - Returns health status and current timestamp
 * - Used by monitoring systems to check if service is alive
 *
 * Parameters:
 * - None
 *
 * Returns:
 * - JSON response with ok status and timestamp
 */
router.get('/', (_req, res) => {
  res.json({
    ok: HEALTH_STATUS_OK,
    ts: Date.now(),
  });
});

/**
 * Route: GET /ready
 * Description:
 * - Readiness probe endpoint
 * - Returns readiness status
 * - Can be extended to include database connectivity checks
 *
 * Parameters:
 * - None
 *
 * Returns:
 * - JSON response with ready status
 */
router.get('/ready', (_req, res) => {
  res.json({
    ready: READY_STATUS_READY,
  });
});

//----------------------------------------------------
// 5. Helper Functions
//----------------------------------------------------
// No helper functions

//----------------------------------------------------
// 6. Export
//----------------------------------------------------
export default router;
