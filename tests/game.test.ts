// tests/game.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/lib/supabase';
import { createTestUser, cleanupTestUsers } from './setup';
import { GameStatus } from '../src/types/game';

const app = createApp();

describe('Game API', () => {
  let authToken: string;
  let userId: string;
  let quizId: string;
  const createdUserIds: string[] = [];

  // Helper functions for test setup
  async function createTestUserWithAuth(): Promise<{ userId: string; authToken: string }> {
    const testUserData = createTestUser('game-test');

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testUserData.email,
      password: testUserData.password,
      email_confirm: true,
    });

    if (authError) throw authError;
    const userId = authData.user.id;
    createdUserIds.push(userId);

    // Manually create profile if trigger fails or is slow
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      username: testUserData.username,
      display_name: testUserData.displayName,
      role: 'player',
    });

    if (profileError) {
      console.warn('Manual profile creation failed, waiting for trigger...', profileError);
      // Wait for profile to be created by trigger
      await waitForProfileCreation(userId);
    }

    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: testUserData.email,
      password: testUserData.password,
    });

    if (signInError) throw signInError;
    return { userId, authToken: signInData.session.access_token };
  }

  async function waitForProfileCreation(userId: string): Promise<void> {
    let retryCount = 0;
    const maxRetries = 10;
    const baseDelay = 100;

    while (retryCount < maxRetries) {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (profile && !error) return;

      await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(1.5, retryCount)));
      retryCount++;
    }
    throw new Error('Profile creation timed out');
  }

  async function createQuizSet(userId: string): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('quiz_sets')
      .insert({
        user_id: userId,
        title: 'Test Quiz for Game',
        description: 'A test quiz',
        is_public: true,
        difficulty_level: 'medium',
        category: 'General Knowledge',
        total_questions: 5,
        status: 'draft', // Changed to draft to satisfy RLS policy
        play_settings: { code: 123456 }, // Fixed code for testing
        tags: ['test'],
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  beforeEach(async () => {
    const auth = await createTestUserWithAuth();
    userId = auth.userId;
    authToken = auth.authToken;
    quizId = await createQuizSet(userId);
  });

  afterEach(async () => {
    await cleanupTestUsers(createdUserIds);
    createdUserIds.length = 0;
  });

  it('should create a game successfully with quiz code', async () => {
    const response = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        quiz_set_id: quizId,
        game_settings: {
          show_correct_answer: true,
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.game).toBeDefined();
    expect(response.body.game.quiz_set_id).toBe(quizId);
    expect(response.body.game.game_code).toBe('123456');
    expect(response.body.game.status).toBe(GameStatus.WAITING);
    expect(response.body.game.user_id).toBe(userId);
  });

  it('should create a game with fallback code if quiz code is taken', async () => {
    // Create first game
    await request(app).post('/games').set('Authorization', `Bearer ${authToken}`).send({
      quiz_set_id: quizId,
    });

    // Create second game for same quiz
    const response = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        quiz_set_id: quizId,
      });

    expect(response.status).toBe(201);
    expect(response.body.game).toBeDefined();
    expect(response.body.game.quiz_set_id).toBe(quizId);
    expect(response.body.game.game_code).not.toBe('123456'); // Should be different
    expect(response.body.game.game_code).toHaveLength(6);
  });

  it('should fail if quiz_set_id is invalid', async () => {
    const response = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        quiz_set_id: '00000000-0000-0000-0000-000000000000',
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_found');
  });

  it('should fail if input validation fails', async () => {
    const response = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        // Missing quiz_set_id
        game_settings: {},
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('validation_error');
  });
});
