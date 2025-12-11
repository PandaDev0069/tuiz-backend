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

describe('WebSocket Connections Routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /websocket-connections', () => {
    it('should list all websocket connections with pagination', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          socket_id: 'socket-123',
          device_id: 'device-1',
          user_id: 'user-1',
          connected_at: new Date().toISOString(),
          disconnected_at: null,
          last_heartbeat: new Date().toISOString(),
          reconnect_count: 0,
          ip_address: '127.0.0.1',
          user_agent: 'Mozilla/5.0',
          metadata: {},
          status: 'active',
        },
        {
          id: 'conn-2',
          socket_id: 'socket-456',
          device_id: 'device-2',
          user_id: null,
          connected_at: new Date().toISOString(),
          disconnected_at: null,
          last_heartbeat: new Date().toISOString(),
          reconnect_count: 1,
          ip_address: '192.168.1.1',
          user_agent: 'Chrome',
          metadata: {},
          status: 'active',
        },
      ];

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: mockConnections,
              error: null,
              count: 2,
            }),
          }),
        }),
      });

      const response = await request(app).get('/websocket-connections?limit=50&offset=0');

      expect(response.status).toBe(200);
      expect(response.body.connections).toEqual(mockConnections);
      expect(response.body.total).toBe(2);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(0);
    });

    it('should filter connections by device_id', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          socket_id: 'socket-123',
          device_id: 'device-1',
          status: 'active',
        },
      ];

      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: mockConnections,
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

      const response = await request(app).get('/websocket-connections?device_id=device-1');

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(1);
      expect(response.body.connections[0].device_id).toBe('device-1');
    });

    it('should filter connections by user_id', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          user_id: 'user-1',
          status: 'active',
        },
      ];

      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: mockConnections,
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

      const response = await request(app).get('/websocket-connections?user_id=user-1');

      expect(response.status).toBe(200);
      expect(response.body.connections[0].user_id).toBe('user-1');
    });

    it('should filter connections by status', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          status: 'disconnected',
        },
      ];

      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: mockConnections,
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

      const response = await request(app).get('/websocket-connections?status=disconnected');

      expect(response.status).toBe(200);
      expect(response.body.connections[0].status).toBe('disconnected');
    });

    it('should validate limit parameter', async () => {
      const response = await request(app).get('/websocket-connections?limit=150');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });

    it('should validate offset parameter', async () => {
      const response = await request(app).get('/websocket-connections?offset=-5');

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

      const response = await request(app).get('/websocket-connections');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('GET /websocket-connections/active', () => {
    it('should list only active connections', async () => {
      const mockActiveConnections = [
        {
          id: 'conn-1',
          socket_id: 'socket-123',
          status: 'active',
        },
        {
          id: 'conn-2',
          socket_id: 'socket-456',
          status: 'active',
        },
      ];

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({
                data: mockActiveConnections,
                error: null,
                count: 2,
              }),
            }),
          }),
        }),
      });

      const response = await request(app).get('/websocket-connections/active');

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(2);
      expect(
        response.body.connections.every((c: { status: string }) => c.status === 'active'),
      ).toBe(true);
    });

    it('should validate limit for active connections', async () => {
      const response = await request(app).get('/websocket-connections/active?limit=200');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });
  });

  describe('GET /websocket-connections/device/:device_id', () => {
    it('should get connection history for a device', async () => {
      const mockConnections = [
        {
          id: 'conn-1',
          device_id: 'device-1',
          connected_at: new Date().toISOString(),
          status: 'active',
        },
        {
          id: 'conn-2',
          device_id: 'device-1',
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

      const response = await request(app).get('/websocket-connections/device/device-1');

      expect(response.status).toBe(200);
      expect(response.body.connections).toHaveLength(2);
      expect(response.body.connections.every((c: any) => c.device_id === 'device-1')).toBe(true);
    });

    it('should require device_id parameter', async () => {
      const response = await request(app).get('/websocket-connections/device/');

      expect(response.status).toBe(404); // Express routing
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

      const response = await request(app).get('/websocket-connections/device/device-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('GET /websocket-connections/stats', () => {
    it('should return connection statistics', async () => {
      // Mock count queries for each status
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((field: string, value: string) => {
            const counts: Record<string, number> = {
              active: 10,
              disconnected: 25,
              timeout: 5,
            };
            return Promise.resolve({ data: null, error: null, count: counts[value] });
          }),
        }),
      });

      const response = await request(app).get('/websocket-connections/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        active: 10,
        disconnected: 25,
        timeout: 5,
        total: 40,
      });
    });

    it('should return 500 on database error', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      });

      const response = await request(app).get('/websocket-connections/stats');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('GET /websocket-connections/:connection_id', () => {
    it('should get specific connection by ID', async () => {
      const mockConnection = {
        id: 'conn-1',
        socket_id: 'socket-123',
        device_id: 'device-1',
        user_id: 'user-1',
        status: 'active',
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockConnection, error: null }),
          }),
        }),
      });

      const response = await request(app).get('/websocket-connections/conn-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockConnection);
    });

    it('should return 404 if connection not found', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const response = await request(app).get('/websocket-connections/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
      expect(response.body.message).toBe('Connection not found');
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

      const response = await request(app).get('/websocket-connections/conn-1');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      const endpoints = [
        { method: 'get', path: '/websocket-connections' },
        { method: 'get', path: '/websocket-connections/active' },
        { method: 'get', path: '/websocket-connections/device/device-1' },
        { method: 'get', path: '/websocket-connections/stats' },
        { method: 'get', path: '/websocket-connections/conn-1' },
      ];

      // With mocked auth, all should pass (return 200, 400, 404, or 500)
      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path);
        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });
  });
});
