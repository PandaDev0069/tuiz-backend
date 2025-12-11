// tests/unit/playerService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerService } from '../../src/services/playerService';
import { supabaseAdmin } from '../../src/lib/supabase';

describe('PlayerService - Validation', () => {
  let service: PlayerService;

  beforeEach(() => {
    service = new PlayerService(supabaseAdmin);
  });

  it('should reject when game_id is missing', async () => {
    const result = await service.createPlayer({
      game_id: '',
      device_id: 'device-123',
      player_name: 'Test Player',
      is_logged_in: false,
      is_host: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('game_id is required');
  });

  it('should reject when device_id is missing', async () => {
    const result = await service.createPlayer({
      game_id: 'test-game-id',
      device_id: '',
      player_name: 'Test Player',
      is_logged_in: false,
      is_host: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('device_id is required');
  });

  it('should reject when player_name is missing', async () => {
    const result = await service.createPlayer({
      game_id: 'test-game-id',
      device_id: 'device-123',
      player_name: '',
      is_logged_in: false,
      is_host: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('player_name is required');
  });

  it('should reject when player_name is only whitespace', async () => {
    const result = await service.createPlayer({
      game_id: 'test-game-id',
      device_id: 'device-123',
      player_name: '   ',
      is_logged_in: false,
      is_host: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('player_name is required');
  });

  it('should return error when game does not exist', async () => {
    const nonExistentGameId = '00000000-0000-0000-0000-000000000000';
    const result = await service.createPlayer({
      game_id: nonExistentGameId,
      device_id: 'device-123',
      player_name: 'Test Player',
      is_logged_in: false,
      is_host: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Game not found');
  });

  it('should reject update with empty player_name', async () => {
    const result = await service.updatePlayer('test-player-id', {
      player_name: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('player_name cannot be empty');
  });

  it('should reject update with no fields', async () => {
    const result = await service.updatePlayer('test-player-id', {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('No updates provided');
  });
});
