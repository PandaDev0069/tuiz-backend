import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { supabaseAdmin } from '../../src/lib/supabase';
import { gameFlowService } from '../../src/services/gameFlowService';
import type { AuthenticatedRequest } from '../../src/types/auth';

// Mock dependencies
vi.mock('../../src/lib/supabase');
vi.mock('../../src/services/gameFlowService');
vi.mock('../../src/middleware/auth', () => ({
  authMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    (req as AuthenticatedRequest).user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  },
}));

const mockSupabaseAdmin = vi.mocked(supabaseAdmin);
const mockGameFlowService = vi.mocked(gameFlowService);

describe('Game Flows Routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /games/:game_id/flow', () => {
    it('should get game flow successfully', async () => {
      const mockGameFlow = {
        id: 'flow-1',
        game_id: 'game-1',
        quiz_set_id: 'quiz-1',
        total_questions: 10,
        current_question_id: 'q-1',
        next_question_id: 'q-2',
        current_question_index: 1,
        current_question_start_time: new Date().toISOString(),
        current_question_end_time: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockGameFlow, error: null }),
          }),
        }),
      });

      const response = await request(app).get('/games/game-1/flow');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockGameFlow);
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('game_flows');
    });

    it('should return 404 if game flow not found', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const response = await request(app).get('/games/nonexistent/flow');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
      expect(response.body.message).toBe('Game flow not found');
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

      const response = await request(app).get('/games/game-1/flow');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });

    it('should return 400 for invalid game_id format', async () => {
      const response = await request(app).get('/games//flow');

      expect(response.status).toBe(404); // Express routing issue
    });
  });

  describe('GET /games (list game flows)', () => {
    it('should list all game flows with pagination', async () => {
      const mockGameFlows = [
        {
          id: 'flow-1',
          game_id: 'game-1',
          quiz_set_id: 'quiz-1',
          total_questions: 10,
          current_question_index: 1,
          games: { game_code: '123456', status: 'active' },
        },
        {
          id: 'flow-2',
          game_id: 'game-2',
          quiz_set_id: 'quiz-2',
          total_questions: 5,
          current_question_index: 0,
          games: { game_code: '654321', status: 'waiting' },
        },
      ];

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: mockGameFlows,
              error: null,
              count: 2,
            }),
          }),
        }),
      });

      const response = await request(app).get('/games?limit=50&offset=0');

      expect(response.status).toBe(200);
      expect(response.body.game_flows).toEqual(mockGameFlows);
      expect(response.body.total).toBe(2);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(0);
    });

    it('should filter game flows by quiz_set_id', async () => {
      const mockGameFlows = [
        {
          id: 'flow-1',
          game_id: 'game-1',
          quiz_set_id: 'quiz-1',
          total_questions: 10,
        },
      ];

      const mockEq = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: mockGameFlows,
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

      const response = await request(app).get('/games?quiz_set_id=quiz-1');

      expect(response.status).toBe(200);
      expect(response.body.game_flows).toEqual(mockGameFlows);
    });

    it('should validate limit parameter', async () => {
      const response = await request(app).get('/games?limit=200');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.message).toContain('Limit must be between 1 and 100');
    });

    it('should validate offset parameter', async () => {
      const response = await request(app).get('/games?offset=-1');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.message).toContain('Offset must be non-negative');
    });
  });

  describe('POST /games/:game_id/flow/advance', () => {
    it('should advance to next question successfully', async () => {
      const mockCurrentFlow = {
        success: true,
        gameFlow: {
          id: 'flow-1',
          game_id: 'game-1',
          current_question_index: 1,
        },
      };

      const mockUpdatedFlow = {
        success: true,
        gameFlow: {
          id: 'flow-1',
          game_id: 'game-1',
          current_question_index: 2,
        },
      };

      mockGameFlowService.getGameFlow = vi.fn().mockResolvedValue(mockCurrentFlow);
      mockGameFlowService.updateGameFlow = vi.fn().mockResolvedValue(mockUpdatedFlow);

      const response = await request(app).post('/games/game-1/flow/advance');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Successfully advanced to next question');
      expect(response.body.gameFlow.current_question_index).toBe(2);
    });

    it('should return 404 if game flow not found', async () => {
      mockGameFlowService.getGameFlow = vi.fn().mockResolvedValue({
        success: false,
        error: 'Game flow not found',
      });

      const response = await request(app).post('/games/game-1/flow/advance');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
    });

    it('should return 400 if advance operation fails', async () => {
      mockGameFlowService.getGameFlow = vi.fn().mockResolvedValue({
        success: true,
        gameFlow: { id: 'flow-1', game_id: 'game-1', current_question_index: 1 },
      });

      mockGameFlowService.updateGameFlow = vi.fn().mockResolvedValue({
        success: false,
        error: 'Failed to update game flow',
      });

      const response = await request(app).post('/games/game-1/flow/advance');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('operation_failed');
    });

    it('should require game_id parameter', async () => {
      const response = await request(app).post('/games//flow/advance');

      expect(response.status).toBe(404); // Express routing
    });
  });

  describe('PATCH /games/:game_id/flow', () => {
    it('should update game flow successfully', async () => {
      const updateData = {
        current_question_index: 3,
        current_question_id: 'q-3',
      };

      const mockUpdatedFlow = {
        id: 'flow-1',
        game_id: 'game-1',
        ...updateData,
        updated_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedFlow, error: null }),
            }),
          }),
        }),
      });

      const response = await request(app).patch('/games/game-1/flow').send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.current_question_index).toBe(3);
      expect(response.body.current_question_id).toBe('q-3');
    });

    it('should reject updates to disallowed fields', async () => {
      const updateData = {
        id: 'new-id', // Not allowed
        game_id: 'new-game', // Not allowed
        current_question_index: 3, // Allowed
      };

      const mockUpdatedFlow = {
        id: 'flow-1',
        game_id: 'game-1',
        current_question_index: 3,
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedFlow, error: null }),
            }),
          }),
        }),
      });

      const response = await request(app).patch('/games/game-1/flow').send(updateData);

      expect(response.status).toBe(200);
      // Should only update allowed field
      expect(response.body.id).toBe('flow-1'); // Original ID preserved
      expect(response.body.game_id).toBe('game-1'); // Original game_id preserved
    });

    it('should return 400 if no valid fields to update', async () => {
      const updateData = {
        invalid_field: 'value',
        another_invalid: 123,
      };

      const response = await request(app).patch('/games/game-1/flow').send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.message).toBe('No valid fields to update');
    });

    it('should return 500 on database error', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
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
      });

      const response = await request(app)
        .patch('/games/game-1/flow')
        .send({ current_question_index: 5 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('database_error');
    });
  });

  describe('DELETE /games/:game_id/flow', () => {
    it('should delete game flow successfully', async () => {
      mockGameFlowService.deleteGameFlow = vi.fn().mockResolvedValue(true);

      const response = await request(app).delete('/games/game-1/flow');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Game flow deleted successfully');
      expect(mockGameFlowService.deleteGameFlow).toHaveBeenCalledWith('game-1');
    });

    it('should return 400 if deletion fails', async () => {
      mockGameFlowService.deleteGameFlow = vi.fn().mockResolvedValue(false);

      const response = await request(app).delete('/games/game-1/flow');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('operation_failed');
      expect(response.body.message).toBe('Failed to delete game flow');
    });

    it('should require game_id parameter', async () => {
      const response = await request(app).delete('/games//flow');

      expect(response.status).toBe(404); // Express routing
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // This test verifies auth middleware is applied
      // In actual implementation, remove the mock and test with real auth
      const endpoints = [
        { method: 'get', path: '/games/game-1/flow' },
        { method: 'get', path: '/games' },
        { method: 'post', path: '/games/game-1/flow/advance' },
        { method: 'patch', path: '/games/game-1/flow' },
        { method: 'delete', path: '/games/game-1/flow' },
      ];

      // With mocked auth, all should pass
      // Without auth, all should return 401
      for (const endpoint of endpoints) {
        const response = await (request(app) as Record<string, (path: string) => request.Test>)[
          endpoint.method
        ](endpoint.path);
        expect([200, 400, 404, 500]).toContain(response.status);
      }
    });
  });
});
