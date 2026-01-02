// tests/unit/gameFlowService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameFlowService } from '../../src/services/gameFlowService';

describe('GameFlowService', () => {
  let service: GameFlowService;

  beforeEach(() => {
    service = new GameFlowService();
  });

  describe('createGameFlow - validation', () => {
    it('should reject when game_id is missing', async () => {
      const result = await service.createGameFlow({
        game_id: '',
        quiz_set_id: '550e8400-e29b-41d4-a716-446655440001',
        total_questions: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('game_id is required');
      expect(result.gameFlow).toBeUndefined();
    });

    it('should reject when quiz_set_id is missing', async () => {
      const result = await service.createGameFlow({
        game_id: '550e8400-e29b-41d4-a716-446655440000',
        quiz_set_id: '',
        total_questions: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('quiz_set_id is required');
      expect(result.gameFlow).toBeUndefined();
    });

    it('should reject when total_questions is negative', async () => {
      const result = await service.createGameFlow({
        game_id: '550e8400-e29b-41d4-a716-446655440000',
        quiz_set_id: '550e8400-e29b-41d4-a716-446655440001',
        total_questions: -1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('total_questions must be non-negative');
      expect(result.gameFlow).toBeUndefined();
    });

    it('should return error when game_id does not exist in database', async () => {
      const result = await service.createGameFlow({
        game_id: '00000000-0000-0000-0000-000000000000',
        quiz_set_id: '00000000-0000-0000-0000-000000000001',
        total_questions: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Game not found');
      expect(result.gameFlow).toBeUndefined();
    });
  });
});
