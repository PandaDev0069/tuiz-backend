// tests/unit/gameEventService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEventService } from '../../src/services/gameEventService';
import { GameEventType } from '../../src/types/gameEvent';
import { supabaseAdmin } from '../../src/lib/supabase';

describe('GameEventService - Validation', () => {
  let service: GameEventService;

  beforeEach(() => {
    service = new GameEventService(supabaseAdmin);
  });

  it('should reject when game_id is missing', async () => {
    const result = await service.createGameEvent({
      game_id: '',
      event_type: GameEventType.GAME_START,
      action: 'start_game',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('game_id is required');
  });

  it('should reject when event_type is missing', async () => {
    const result = await service.createGameEvent({
      game_id: 'test-game-id',
      event_type: '' as GameEventType,
      action: 'start_game',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('event_type is required');
  });

  it('should reject when action is missing', async () => {
    const result = await service.createGameEvent({
      game_id: 'test-game-id',
      event_type: GameEventType.GAME_START,
      action: '',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('action is required');
  });

  it('should return error when game does not exist', async () => {
    const nonExistentGameId = '00000000-0000-0000-0000-000000000000';
    const result = await service.createGameEvent({
      game_id: nonExistentGameId,
      event_type: GameEventType.GAME_START,
      action: 'start_game',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Game not found');
  });
});
