import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CreateRoomParticipantData,
  UpdateParticipantStatusData,
  ParticipantQuery,
  RoomParticipant,
  RoomParticipantWithPlayer,
  ActiveParticipantsSummary,
  RejoinRoomData,
} from '../types/roomParticipant.js';
import { logger } from '../utils/logger.js';

/**
 * Service for managing room participants
 * Tracks WebSocket connections, room membership, and participant history
 */
export class RoomParticipantService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Add a participant to a room
   */
  async addParticipant(
    data: CreateRoomParticipantData,
  ): Promise<{ success: boolean; participant?: RoomParticipant; error?: string }> {
    try {
      // Validate required fields
      if (!data.game_id) {
        logger.error('addParticipant called with missing game_id');
        return { success: false, error: 'game_id is required' };
      }

      if (!data.socket_id) {
        logger.error({ gameId: data.game_id }, 'addParticipant called with missing socket_id');
        return { success: false, error: 'socket_id is required' };
      }

      if (!data.device_id) {
        logger.error({ gameId: data.game_id }, 'addParticipant called with missing device_id');
        return { success: false, error: 'device_id is required' };
      }

      if (!data.player_id) {
        logger.error({ gameId: data.game_id }, 'addParticipant called with missing player_id');
        return { success: false, error: 'player_id is required' };
      }

      // Verify game exists
      const { data: game, error: gameError } = await this.supabase
        .from('games')
        .select('id')
        .eq('id', data.game_id)
        .maybeSingle();

      if (gameError || !game) {
        logger.error({ error: gameError, gameId: data.game_id }, 'Game not found');
        return { success: false, error: 'Game not found' };
      }

      // Verify player exists
      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .select('id')
        .eq('id', data.player_id)
        .maybeSingle();

      if (playerError || !player) {
        logger.error({ error: playerError, playerId: data.player_id }, 'Player not found');
        return { success: false, error: 'Player not found' };
      }

      // Insert participant record
      const { data: participant, error } = await this.supabase
        .from('room_participants')
        .insert({
          game_id: data.game_id,
          socket_id: data.socket_id,
          device_id: data.device_id,
          player_id: data.player_id,
          user_id: data.user_id || null,
          role: data.role || 'player',
          status: 'active',
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (error) {
        logger.error({ error }, 'Error adding participant');
        return { success: false, error: 'Failed to add participant' };
      }

      logger.info({ participantId: participant.id, gameId: data.game_id }, 'Participant added');
      return { success: true, participant };
    } catch (error) {
      logger.error({ error }, 'Unexpected error adding participant');
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Update participant status (active, disconnected, timeout)
   */
  async updateParticipantStatus(
    participantId: string,
    data: UpdateParticipantStatusData,
  ): Promise<{ success: boolean; participant?: RoomParticipant; error?: string }> {
    try {
      if (!participantId) {
        logger.error('updateParticipantStatus called with missing participantId');
        return { success: false, error: 'participantId is required' };
      }

      if (!data.status) {
        logger.error({ participantId }, 'updateParticipantStatus called with missing status');
        return { success: false, error: 'status is required' };
      }

      const updateData: Record<string, unknown> = {
        status: data.status,
      };

      // Update socket_id if provided (for reconnection)
      if (data.socket_id) {
        updateData.socket_id = data.socket_id;
      }

      // Update metadata if provided
      if (data.metadata) {
        updateData.metadata = data.metadata;
      }

      // Set left_at if status is disconnected or timeout
      if (data.status === 'disconnected' || data.status === 'timeout') {
        updateData.left_at = new Date().toISOString();
      }

      const { data: participant, error } = await this.supabase
        .from('room_participants')
        .update(updateData)
        .eq('id', participantId)
        .select()
        .single();

      if (error) {
        logger.error({ error, participantId }, 'Error updating participant status');
        return { success: false, error: 'Failed to update participant status' };
      }

      logger.info({ participantId, status: data.status }, 'Participant status updated');
      return { success: true, participant };
    } catch (error) {
      logger.error({ error }, 'Unexpected error updating participant status');
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get participants for a game with player details
   */
  async getGameParticipants(
    gameId: string,
    query: Partial<ParticipantQuery> = {},
  ): Promise<{ success: boolean; participants?: RoomParticipantWithPlayer[]; error?: string }> {
    try {
      if (!gameId) {
        logger.error('getGameParticipants called with missing gameId');
        return { success: false, error: 'gameId is required' };
      }

      let dbQuery = this.supabase
        .from('room_participants')
        .select(
          `
          *,
          players (
            name,
            is_host,
            user_id
          )
        `,
        )
        .eq('game_id', gameId);

      // Apply filters
      if (query.status) {
        dbQuery = dbQuery.eq('status', query.status);
      }

      if (query.role) {
        dbQuery = dbQuery.eq('role', query.role);
      }

      if (query.device_id) {
        dbQuery = dbQuery.eq('device_id', query.device_id);
      }

      // Apply pagination
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      dbQuery = dbQuery.range(offset, offset + limit - 1).order('joined_at', { ascending: false });

      const { data: participants, error } = await dbQuery;

      if (error) {
        logger.error({ error, gameId }, 'Error fetching game participants');
        return { success: false, error: 'Failed to fetch participants' };
      }

      // Transform data with player details
      interface ParticipantData {
        id: string;
        game_id: string;
        socket_id: string;
        device_id: string;
        player_id: string;
        user_id: string | null;
        joined_at: string;
        left_at: string | null;
        role: string;
        status: 'active' | 'disconnected' | 'timeout';
        metadata: Record<string, unknown>;
        players: { name: string; is_host: boolean; user_id: string | null } | null;
      }
      const result: RoomParticipantWithPlayer[] = (participants || []).map((p: ParticipantData) => {
        const player = p.players;
        return {
          id: p.id,
          game_id: p.game_id,
          socket_id: p.socket_id,
          device_id: p.device_id,
          player_id: p.player_id,
          player_name: player?.name || 'Unknown',
          user_id: p.user_id,
          joined_at: p.joined_at,
          left_at: p.left_at,
          role: p.role,
          status: p.status,
          is_host: player?.is_host || false,
          is_logged_in: !!p.user_id,
          metadata: p.metadata,
        };
      });

      return { success: true, participants: result };
    } catch (error) {
      logger.error({ error }, 'Unexpected error fetching game participants');
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get active participants summary for a game
   */
  async getActiveParticipantsSummary(
    gameId: string,
  ): Promise<{ success: boolean; summary?: ActiveParticipantsSummary; error?: string }> {
    try {
      if (!gameId) {
        logger.error('getActiveParticipantsSummary called with missing gameId');
        return { success: false, error: 'gameId is required' };
      }

      // Fetch all participants with player details
      const { data: participants, error } = await this.supabase
        .from('room_participants')
        .select(
          `
          *,
          players (
            name,
            is_host,
            user_id
          )
        `,
        )
        .eq('game_id', gameId)
        .order('joined_at', { ascending: false });

      if (error) {
        logger.error({ error, gameId }, 'Error fetching active participants summary');
        return { success: false, error: 'Failed to fetch participants summary' };
      }

      // Transform and calculate summary
      interface ParticipantData {
        id: string;
        game_id: string;
        socket_id: string;
        device_id: string;
        player_id: string;
        user_id: string | null;
        joined_at: string;
        left_at: string | null;
        role: string;
        status: 'active' | 'disconnected' | 'timeout';
        metadata: Record<string, unknown>;
        players: { name: string; is_host: boolean; user_id: string | null } | null;
      }
      const participantsList: RoomParticipantWithPlayer[] = (participants || []).map(
        (p: ParticipantData) => {
          const player = p.players;
          return {
            id: p.id,
            game_id: p.game_id,
            socket_id: p.socket_id,
            device_id: p.device_id,
            player_id: p.player_id,
            player_name: player?.name || 'Unknown',
            user_id: p.user_id,
            joined_at: p.joined_at,
            left_at: p.left_at,
            role: p.role,
            status: p.status,
            is_host: player?.is_host || false,
            is_logged_in: !!p.user_id,
            metadata: p.metadata,
          };
        },
      );

      const activeCount = participantsList.filter((p) => p.status === 'active').length;
      const disconnectedCount = participantsList.filter(
        (p) => p.status === 'disconnected' || p.status === 'timeout',
      ).length;
      const hosts = participantsList.filter((p) => p.is_host).length;
      const players = participantsList.filter((p) => p.role === 'player').length;
      const spectators = participantsList.filter((p) => p.role === 'spectator').length;

      const summary: ActiveParticipantsSummary = {
        game_id: gameId,
        total_participants: participantsList.length,
        active_count: activeCount,
        disconnected_count: disconnectedCount,
        hosts,
        players,
        spectators,
        participants: participantsList,
      };

      return { success: true, summary };
    } catch (error) {
      logger.error({ error }, 'Unexpected error fetching active participants summary');
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get participant by socket ID
   */
  async getParticipantBySocketId(
    socketId: string,
  ): Promise<{ success: boolean; participant?: RoomParticipant; error?: string }> {
    try {
      if (!socketId) {
        logger.error('getParticipantBySocketId called with missing socketId');
        return { success: false, error: 'socketId is required' };
      }

      const { data: participant, error } = await this.supabase
        .from('room_participants')
        .select('*')
        .eq('socket_id', socketId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        logger.error({ error, socketId }, 'Error fetching participant by socket');
        return { success: false, error: 'Failed to fetch participant' };
      }

      if (!participant) {
        return { success: false, error: 'Participant not found' };
      }

      return { success: true, participant };
    } catch (error) {
      logger.error({ error }, 'Unexpected error fetching participant by socket');
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Rejoin a room (reconnection support)
   * Updates existing participant record with new socket_id
   */
  async rejoinRoom(
    gameId: string,
    playerId: string,
    data: RejoinRoomData,
  ): Promise<{ success: boolean; participant?: RoomParticipant; error?: string }> {
    try {
      if (!gameId) {
        logger.error('rejoinRoom called with missing gameId');
        return { success: false, error: 'gameId is required' };
      }

      if (!playerId) {
        logger.error({ gameId }, 'rejoinRoom called with missing playerId');
        return { success: false, error: 'playerId is required' };
      }

      // Find most recent participant record for this player
      const { data: existingParticipant, error: fetchError } = await this.supabase
        .from('room_participants')
        .select('*')
        .eq('game_id', gameId)
        .eq('player_id', playerId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        logger.error({ error: fetchError, gameId, playerId }, 'Error finding participant');
        return { success: false, error: 'Failed to find participant' };
      }

      if (!existingParticipant) {
        logger.warn({ gameId, playerId }, 'No existing participant found for rejoin');
        return { success: false, error: 'No participant record found' };
      }

      // Update participant with new socket and reactivate
      const { data: participant, error: updateError } = await this.supabase
        .from('room_participants')
        .update({
          socket_id: data.socket_id,
          status: 'active',
          left_at: null,
          metadata: data.metadata || existingParticipant.metadata,
        })
        .eq('id', existingParticipant.id)
        .select()
        .single();

      if (updateError) {
        logger.error(
          { error: updateError, participantId: existingParticipant.id },
          'Error rejoining room',
        );
        return { success: false, error: 'Failed to rejoin room' };
      }

      logger.info({ participantId: participant.id, gameId, playerId }, 'Participant rejoined room');
      return { success: true, participant };
    } catch (error) {
      logger.error({ error }, 'Unexpected error rejoining room');
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Remove a participant from a room (mark as left)
   */
  async removeParticipant(participantId: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!participantId) {
        logger.error('removeParticipant called with missing participantId');
        return { success: false, error: 'participantId is required' };
      }

      const { error } = await this.supabase
        .from('room_participants')
        .update({
          status: 'disconnected',
          left_at: new Date().toISOString(),
        })
        .eq('id', participantId);

      if (error) {
        logger.error({ error, participantId }, 'Error removing participant');
        return { success: false, error: 'Failed to remove participant' };
      }

      logger.info({ participantId }, 'Participant removed');
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Unexpected error removing participant');
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get participant history for a device
   */
  async getDeviceParticipantHistory(
    deviceId: string,
    limit: number = 10,
  ): Promise<{ success: boolean; participants?: RoomParticipant[]; error?: string }> {
    try {
      if (!deviceId) {
        logger.error('getDeviceParticipantHistory called with missing deviceId');
        return { success: false, error: 'deviceId is required' };
      }

      const { data: participants, error } = await this.supabase
        .from('room_participants')
        .select('*')
        .eq('device_id', deviceId)
        .order('joined_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error({ error, deviceId }, 'Error fetching device participant history');
        return { success: false, error: 'Failed to fetch participant history' };
      }

      return { success: true, participants: participants || [] };
    } catch (error) {
      logger.error({ error }, 'Unexpected error fetching device participant history');
      return { success: false, error: 'Internal server error' };
    }
  }
}

// Singleton instance
let roomParticipantServiceInstance: RoomParticipantService | null = null;

export function getRoomParticipantService(supabase: SupabaseClient): RoomParticipantService {
  if (!roomParticipantServiceInstance) {
    roomParticipantServiceInstance = new RoomParticipantService(supabase);
  }
  return roomParticipantServiceInstance;
}
