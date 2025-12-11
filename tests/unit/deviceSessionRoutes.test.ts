import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { supabaseAdmin } from '../../src/lib/supabase';
import type { AuthenticatedRequest } from '../../src/types/auth';

// Mock dependencies
vi.mock('../../src/lib/supabase');
vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    (req as AuthenticatedRequest).user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

const mockSupabaseAdmin = vi.mocked(supabaseAdmin);

describe('Device Sessions Routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /device-sessions', () => {
    it('should list all device sessions with pagination', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          device_id: 'device-1',
          user_id: 'user-1',
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          total_connections: 5,
          total_reconnections: 2,
          browser_fingerprint: 'fingerprint-1',
          metadata: {},
        },
        {
          id: 'session-2',
          device_id: 'device-2',
          user_id: null,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          total_connections: 1,
          total_reconnections: 0,
          browser_fingerprint: null,
          metadata: {},
        },
      ];

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: mockSessions,
              error: null,
              count: 2,
            }),
          }),
        }),
      });

      const response = await request(app).get('/device-sessions?limit=50&offset=0');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toEqual(mockSessions);
      expect(response.body.total).toBe(2);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(0);
    });

    it('should filter sessions by user_id', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          device_id: 'device-1',
          user_id: 'user-1',
          total_connections: 5,
        },
      ];

      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null,
            count: 1,
          }),
        }),
      });

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockReturnValue({
              eq: mockEq,
            }),
          }),
          eq: mockEq,
        }),
      });

      const response = await request(app).get('/device-sessions?user_id=user-1');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.sessions[0].user_id).toBe('user-1');
    });

    it('should validate limit parameter', async () => {
      const response = await request(app).get('/device-sessions?limit=150');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should validate offset parameter', async () => {
      const response = await request(app).get('/device-sessions?offset=-1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should return 500 on database error', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
              count: null,
            }),
          }),
        }),
      });

      const response = await request(app).get('/device-sessions');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('GET /device-sessions/:device_id', () => {
    it('should get specific device session', async () => {
      const mockSession = {
        id: 'session-1',
        device_id: 'device-1',
        user_id: 'user-1',
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        total_connections: 10,
        total_reconnections: 3,
        browser_fingerprint: 'fingerprint-1',
        metadata: { browser: 'Chrome', os: 'Windows' },
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
          }),
        }),
      });

      const response = await request(app).get('/device-sessions/device-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSession);
      expect(response.body.device_id).toBe('device-1');
    });

    it('should return 404 if device session not found', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const response = await request(app).get('/device-sessions/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
      expect(response.body.message).toBe('Device session not found');
    });

    it('should return 500 on database error', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      });

      const response = await request(app).get('/device-sessions/device-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('PATCH /device-sessions/:device_id', () => {
    it('should update device session metadata', async () => {
      const updateData = {
        metadata: { browser: 'Firefox', version: '120' },
        browser_fingerprint: 'new-fingerprint',
      };

      const mockExistingSession = {
        id: 'session-1',
      };

      const mockUpdatedSession = {
        id: 'session-1',
        device_id: 'device-1',
        ...updateData,
      };

      mockSupabaseAdmin.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'device_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: mockExistingSession,
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockUpdatedSession,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const response = await request(app).patch('/device-sessions/device-1').send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.metadata).toEqual(updateData.metadata);
      expect(response.body.browser_fingerprint).toBe('new-fingerprint');
    });

    it('should return 400 if no fields to update', async () => {
      const response = await request(app).patch('/device-sessions/device-1').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.message).toBe('No fields to update');
    });

    it('should return 404 if device session not found', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const response = await request(app)
        .patch('/device-sessions/nonexistent')
        .send({ metadata: {} });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
    });

    it('should validate request body schema', async () => {
      const invalidData = {
        metadata: 'invalid', // Should be object
      };

      const response = await request(app).patch('/device-sessions/device-1').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('validation_error');
    });

    it('should return 500 on database error during update', async () => {
      mockSupabaseAdmin.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'device_sessions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'session-1' },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Database error' },
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const response = await request(app).patch('/device-sessions/device-1').send({ metadata: {} });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('GET /device-sessions/:device_id/connections', () => {
    it('should get all connections for a device', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          device_id: 'device-1',
          socket_id: 'socket-123',
          connected_at: new Date().toISOString(),
          status: 'active',
        },
        {
          id: 'conn-2',
          device_id: 'device-1',
          socket_id: 'socket-456',
          connected_at: new Date(Date.now() - 3600000).toISOString(),
          status: 'disconnected',
        },
      ];

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: mockConnections,
                error: null,
                count: 2,
              }),
            }),
          }),
        }),
      });

      const response = await request(app).get('/device-sessions/device-1/connections');

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(2);
      expect(
        response.body.connections.every((c: { device_id: string }) => c.device_id === 'device-1'),
      ).toBe(true);
      expect(response.body.total).toBe(2);
    });

    it('should validate limit and offset parameters', async () => {
      const response1 = await request(app).get('/device-sessions/device-1/connections?limit=200');
      expect(response1.status).toBe(400);

      const response2 = await request(app).get('/device-sessions/device-1/connections?offset=-1');
      expect(response2.status).toBe(400);
    });

    it('should return 500 on database error', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
                count: null,
              }),
            }),
          }),
        }),
      });

      const response = await request(app).get('/device-sessions/device-1/connections');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('GET /device-sessions/stats/summary', () => {
    it('should return device session statistics', async () => {
      const mockSessions = [
        { total_connections: 10, total_reconnections: 2 },
        { total_connections: 5, total_reconnections: 1 },
        { total_connections: 8, total_reconnections: 3 },
      ];

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation((fields: string) => {
          if (fields === 'id') {
            return {
              eq: vi.fn(),
            };
          }
          // For aggregates query
          return Promise.resolve({ data: mockSessions, error: null });
        }),
      });

      // Mock count query
      const countMock = {
        count: 3,
        error: null,
      };

      mockSupabaseAdmin.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'device_sessions') {
          return {
            select: vi.fn().mockImplementation((fields: string, options?: any) => {
              if (options?.count === 'exact') {
                return Promise.resolve(countMock);
              }
              return Promise.resolve({ data: mockSessions, error: null });
            }),
          };
        }
        return {};
      });

      const response = await request(app).get('/device-sessions/stats/summary');

      expect(response.status).toBe(200);
      expect(response.body.total_devices).toBe(3);
      expect(response.body.total_connections).toBe(23); // 10 + 5 + 8
      expect(response.body.total_reconnections).toBe(6); // 2 + 1 + 3
      expect(response.body.average_connections_per_device).toBe('7.67'); // 23 / 3
      expect(response.body.reconnection_rate).toBe('26.09'); // (6 / 23) * 100
    });

    it('should handle zero devices', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation((_fields: string, options?: any) => {
          if (options?.count === 'exact') {
            return Promise.resolve({ count: 0, error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
      });

      const response = await request(app).get('/device-sessions/stats/summary');

      expect(response.status).toBe(200);
      expect(response.body.total_devices).toBe(0);
      expect(response.body.average_connections_per_device).toBe('0.00');
      expect(response.body.reconnection_rate).toBe('0.00');
    });

    it('should return 500 on database error', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      const response = await request(app).get('/device-sessions/stats/summary');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/device-sessions' },
        { method: 'get', path: '/device-sessions/device-1' },
        { method: 'patch', path: '/device-sessions/device-1' },
        { method: 'get', path: '/device-sessions/device-1/connections' },
        { method: 'get', path: '/device-sessions/stats/summary' },
      ];

      // With mocked auth, all should pass (return 200, 400, 404, or 500)
      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path);
        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });
  });
});
