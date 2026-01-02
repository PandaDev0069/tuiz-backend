import { beforeEach, describe, expect, it } from 'vitest';

import { createClient } from '@supabase/supabase-js';

import { env } from '../../src/config/env.js';
import { RoomParticipantService } from '../../src/services/roomParticipantService.js';

describe('RoomParticipantService - Validation', () => {
  let service: RoomParticipantService;

  beforeEach(() => {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    service = new RoomParticipantService(supabase);
  });

  describe('addParticipant - validation', () => {
    it('should reject when game_id is missing', async () => {
      const result = await service.addParticipant({
        game_id: '',
        socket_id: 'socket-123',
        device_id: 'device-123',
        player_id: 'player-uuid',
        role: 'player',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('game_id is required');
    });

    it('should reject when socket_id is missing', async () => {
      const result = await service.addParticipant({
        game_id: 'game-uuid',
        socket_id: '',
        device_id: 'device-123',
        player_id: 'player-uuid',
        role: 'player',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('socket_id is required');
    });

    it('should reject when device_id is missing', async () => {
      const result = await service.addParticipant({
        game_id: 'game-uuid',
        socket_id: 'socket-123',
        device_id: '',
        player_id: 'player-uuid',
        role: 'player',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('device_id is required');
    });

    it('should reject when player_id is missing', async () => {
      const result = await service.addParticipant({
        game_id: 'game-uuid',
        socket_id: 'socket-123',
        device_id: 'device-123',
        player_id: '',
        role: 'player',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('player_id is required');
    });
  });

  describe('updateParticipantStatus - validation', () => {
    it('should reject when participantId is missing', async () => {
      const result = await service.updateParticipantStatus('', {
        status: 'disconnected',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('participantId is required');
    });

    it('should reject when status is missing', async () => {
      const result = await service.updateParticipantStatus('participant-uuid', {
        status: '' as unknown as 'disconnected',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('status is required');
    });
  });

  describe('getGameParticipants - validation', () => {
    it('should reject when gameId is missing', async () => {
      const result = await service.getGameParticipants('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('gameId is required');
    });
  });

  describe('getActiveParticipantsSummary - validation', () => {
    it('should reject when gameId is missing', async () => {
      const result = await service.getActiveParticipantsSummary('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('gameId is required');
    });
  });

  describe('getParticipantBySocketId - validation', () => {
    it('should reject when socketId is missing', async () => {
      const result = await service.getParticipantBySocketId('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('socketId is required');
    });
  });

  describe('rejoinRoom - validation', () => {
    it('should reject when gameId is missing', async () => {
      const result = await service.rejoinRoom('', 'player-uuid', {
        socket_id: 'socket-123',
        device_id: 'device-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('gameId is required');
    });

    it('should reject when playerId is missing', async () => {
      const result = await service.rejoinRoom('game-uuid', '', {
        socket_id: 'socket-123',
        device_id: 'device-123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('playerId is required');
    });
  });

  describe('removeParticipant - validation', () => {
    it('should reject when participantId is missing', async () => {
      const result = await service.removeParticipant('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('participantId is required');
    });
  });

  describe('getDeviceParticipantHistory - validation', () => {
    it('should reject when deviceId is missing', async () => {
      const result = await service.getDeviceParticipantHistory('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('deviceId is required');
    });
  });
});
