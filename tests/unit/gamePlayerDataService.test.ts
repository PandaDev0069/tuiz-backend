// tests/unit/gamePlayerDataService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GamePlayerDataService } from '../../src/services/gamePlayerDataService';
import { supabaseAdmin } from '../../src/lib/supabase';

describe('GamePlayerDataService - Validation', () => {
  let service: GamePlayerDataService;

  beforeEach(() => {
    service = new GamePlayerDataService(supabaseAdmin);
  });

  it('should reject when player_id is missing', async () => {
    const result = await service.createGamePlayerData({
      player_id: '',
      player_device_id: 'device-123',
      game_id: 'test-game-id',
      score: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('player_id is required');
  });

  it('should reject when game_id is missing', async () => {
    const result = await service.createGamePlayerData({
      player_id: 'test-player-id',
      player_device_id: 'device-123',
      game_id: '',
      score: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('game_id is required');
  });

  it('should reject when player_device_id is missing', async () => {
    const result = await service.createGamePlayerData({
      player_id: 'test-player-id',
      player_device_id: '',
      game_id: 'test-game-id',
      score: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('player_device_id is required');
  });

  it('should reject update with no fields', async () => {
    const result = await service.updateGamePlayerData('test-player-id', 'test-game-id', {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('No updates provided');
  });

  it('should handle submitAnswer for non-existent player', async () => {
    const nonExistentPlayerId = '00000000-0000-0000-0000-000000000000';
    const nonExistentGameId = '00000000-0000-0000-0000-000000000001';

    const result = await service.submitAnswer(nonExistentPlayerId, nonExistentGameId, {
      question_id: '00000000-0000-0000-0000-000000000002',
      question_number: 1,
      answer_id: '00000000-0000-0000-0000-000000000003',
      is_correct: true,
      time_taken: 10,
      points_earned: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Player data not found');
  });
});
