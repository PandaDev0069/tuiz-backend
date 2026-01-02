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
    (req as AuthenticatedRequest).user = { id: 'test-user-id' };
    next();
  },
}));

const mockSupabaseAdmin = vi.mocked(supabaseAdmin);
const mockGameFlowService = vi.mocked(gameFlowService);

describe('Game State Routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /games/:gameId/start', () => {
    it('should start a game successfully', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'waiting',
        user_id: 'test-user-id',
      };

      const mockUpdatedGame = {
        ...mockGame,
        status: 'active',
        started_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedGame, error: null }),
            }),
          }),
        }),
      });

      const response = await request(app).post('/games/game-1/start');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('active');
    });

    it('should return 404 if game not found', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      const response = await request(app).post('/games/nonexistent/start');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
    });

    it('should return 400 if game is already active', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'active',
        user_id: 'test-user-id',
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
            }),
          }),
        }),
      });

      const response = await request(app).post('/games/game-1/start');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_state');
    });
  });

  describe('POST /games/:gameId/questions/start', () => {
    it('should start a question successfully', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'active',
        user_id: 'test-user-id',
      };

      const mockGameFlow = {
        id: 'flow-1',
        game_id: 'game-1',
        current_question_id: 'q-1',
        current_question_index: 0,
        quiz_set_id: 'quiz-1',
        total_questions: 10,
        current_question_start_time: null,
        current_question_end_time: null,
        next_question_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'games') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
            }),
          };
        }
        return {};
      });

      mockGameFlowService.updateGameFlow.mockResolvedValue({
        success: true,
        gameFlow: mockGameFlow,
      });

      const response = await request(app)
        .post('/games/game-1/questions/start')
        .send({ questionId: 'q-1', questionIndex: 0 });

      expect(response.status).toBe(200);
      expect(response.body.current_question_id).toBe('q-1');
    });

    it('should return 400 if questionId is missing', async () => {
      const response = await request(app).post('/games/game-1/questions/start').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_payload');
    });
  });

  describe('POST /games/:gameId/questions/reveal', () => {
    it('should trigger answer reveal successfully', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'active',
        user_id: 'test-user-id',
      };

      const mockGameFlow = {
        id: 'flow-1',
        game_id: 'game-1',
        current_question_end_time: new Date().toISOString(),
        quiz_set_id: 'quiz-1',
        total_questions: 10,
        current_question_id: null,
        current_question_index: 0,
        current_question_start_time: null,
        next_question_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
            }),
          }),
        }),
      });

      mockGameFlowService.updateGameFlow.mockResolvedValue({
        success: true,
        gameFlow: mockGameFlow,
      });

      const response = await request(app).post('/games/game-1/questions/reveal');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Answer reveal triggered');
    });
  });

  describe('PATCH /games/:gameId/status', () => {
    it('should update game status to paused', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'active',
        user_id: 'test-user-id',
      };

      const mockUpdatedGame = {
        ...mockGame,
        status: 'paused',
        paused_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedGame, error: null }),
            }),
          }),
        }),
      });

      const response = await request(app).patch('/games/game-1/status').send({ action: 'pause' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('paused');
    });

    it('should update game status to completed', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'active',
        user_id: 'test-user-id',
      };

      const mockUpdatedGame = {
        ...mockGame,
        status: 'completed',
        ended_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedGame, error: null }),
            }),
          }),
        }),
      });

      const response = await request(app).patch('/games/game-1/status').send({ action: 'end' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should return 400 if status or action is missing', async () => {
      const response = await request(app).patch('/games/game-1/status').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_payload');
    });
  });

  describe('GET /games/:gameId/state', () => {
    it('should get game state successfully', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'active',
        current_question_index: 0,
      };

      const mockGameFlow = {
        id: 'flow-1',
        game_id: 'game-1',
        current_question_id: 'q-1',
        quiz_set_id: 'quiz-1',
        total_questions: 10,
        current_question_index: 0,
        current_question_start_time: null,
        current_question_end_time: null,
        next_question_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
          }),
        }),
      });

      mockGameFlowService.getGameFlow.mockResolvedValue({
        success: true,
        gameFlow: mockGameFlow,
      });

      const response = await request(app).get('/games/game-1/state');

      expect(response.status).toBe(200);
      expect(response.body.game).toBeDefined();
      expect(response.body.gameFlow).toBeDefined();
    });

    it('should return 404 if game not found', async () => {
      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const response = await request(app).get('/games/nonexistent/state');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('not_found');
    });
  });

  describe('GET /games/:gameId', () => {
    it('should get game details successfully', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'active',
        room_code: 'ABC123',
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
          }),
        }),
      });

      const response = await request(app).get('/games/game-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('game-1');
    });
  });

  describe('PATCH /games/:gameId/lock', () => {
    it('should lock game successfully', async () => {
      const mockGame = {
        id: 'game-1',
        status: 'waiting',
        user_id: 'test-user-id',
        locked: false,
      };

      const mockUpdatedGame = {
        ...mockGame,
        locked: true,
      };

      mockSupabaseAdmin.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockGame, error: null }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockUpdatedGame, error: null }),
            }),
          }),
        }),
      });

      const response = await request(app).patch('/games/game-1/lock').send({ locked: true });

      expect(response.status).toBe(200);
      expect(response.body.locked).toBe(true);
    });

    it('should return 400 if locked is not a boolean', async () => {
      const response = await request(app).patch('/games/game-1/lock').send({ locked: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_payload');
    });
  });
});
