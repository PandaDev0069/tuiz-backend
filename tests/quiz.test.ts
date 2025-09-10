// tests/answers.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/lib/supabase';
import { QuestionType, DifficultyLevel } from '../src/types/quiz';
import { createTestUser, cleanupTestUsers } from './setup';

const app = createApp();

describe('Answer API', () => {
  let authToken: string;
  let userId: string;
  let quizId: string;
  let questionId: string;
  let answerId: string;
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    // Create a test user and get auth token
    const testUserData = createTestUser('quiz-test');

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testUserData.email,
      password: testUserData.password,
      email_confirm: true,
    });

    if (authError) throw authError;
    userId = authData.user.id;
    createdUserIds.push(userId);

    // Profile is automatically created by trigger, no need to insert manually

    // Sign in to get real auth token
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: testUserData.email,
      password: testUserData.password,
    });

    if (signInError || !signInData.session) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error('Failed to sign in test user');
    }

    authToken = signInData.session.access_token;

    // Create a test quiz
    const { data: quizData, error: quizError } = await supabaseAdmin
      .from('quiz_sets')
      .insert({
        user_id: userId,
        title: 'Test Quiz',
        description: 'A test quiz',
        is_public: false,
        difficulty_level: 'easy',
        category: 'Test',
        total_questions: 0,
        times_played: 0,
        status: 'draft',
        tags: ['test'],
        play_settings: {
          code: 123456,
          show_question_only: true,
          show_explanation: true,
          time_bonus: false,
          streak_bonus: false,
          show_correct_answer: true,
          max_players: 100,
        },
      })
      .select()
      .single();

    if (quizError) throw quizError;
    quizId = quizData.id;

    // Create a test question
    const { data: questionData, error: questionError } = await supabaseAdmin
      .from('questions')
      .insert({
        question_set_id: quizId,
        question_text: 'What is 2 + 2?',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 5,
      })
      .select()
      .single();

    if (questionError) throw questionError;
    questionId = questionData.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (quizId) {
      await supabaseAdmin.from('quiz_sets').delete().eq('id', quizId);
    }
    if (createdUserIds.length > 0) {
      await cleanupTestUsers(createdUserIds);
      createdUserIds.length = 0;
    }
  });

  describe('POST /quiz/:quizId/questions/:questionId/answers', () => {
    it('should create an answer successfully', async () => {
      const answerData = {
        answer_text: '4',
        is_correct: true,
        order_index: 0,
      };

      const response = await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answerData)
        .expect(201);

      expect(response.body).toMatchObject({
        answer_text: answerData.answer_text,
        is_correct: answerData.is_correct,
        order_index: answerData.order_index,
        question_id: questionId,
      });
      expect(response.body.id).toBeDefined();
      answerId = response.body.id;
    });

    it('should create an answer with image URL', async () => {
      const answerData = {
        answer_text: '4',
        image_url: 'https://example.com/image.jpg',
        is_correct: true,
        order_index: 0,
      };

      const response = await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answerData)
        .expect(201);

      expect(response.body.image_url).toBe(answerData.image_url);
      answerId = response.body.id;
    });

    it('should reject answer with invalid image URL', async () => {
      const answerData = {
        answer_text: '4',
        image_url: 'not-a-valid-url',
        is_correct: true,
        order_index: 0,
      };

      await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answerData)
        .expect(400);
    });

    it('should reject answer with empty text', async () => {
      const answerData = {
        answer_text: '',
        is_correct: true,
        order_index: 0,
      };

      await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answerData)
        .expect(400);
    });

    it('should reject answer with text too long', async () => {
      const answerData = {
        answer_text: 'A'.repeat(201), // 201 characters
        is_correct: true,
        order_index: 0,
      };

      await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answerData)
        .expect(400);
    });

    it('should reject request for non-existent question', async () => {
      const answerData = {
        answer_text: '4',
        is_correct: true,
        order_index: 0,
      };

      await request(app)
        .post(`/quiz/${quizId}/questions/non-existent-id/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answerData)
        .expect(404);
    });
  });

  describe('PUT /quiz/:quizId/questions/:questionId/answers/:answerId', () => {
    beforeEach(async () => {
      // Create an answer for update tests
      const answerData = {
        answer_text: '4',
        is_correct: true,
        order_index: 0,
      };

      const response = await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answerData);

      answerId = response.body.id;
    });

    it('should update answer successfully', async () => {
      const updateData = {
        answer_text: 'Four',
        is_correct: true,
        order_index: 1,
      };

      const response = await request(app)
        .put(`/quiz/${quizId}/questions/${questionId}/answers/${answerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.answer_text).toBe('Four');
      expect(response.body.order_index).toBe(1);
    });

    it('should reject update for non-existent answer', async () => {
      const updateData = {
        answer_text: 'Four',
        is_correct: true,
        order_index: 1,
      };

      await request(app)
        .put(`/quiz/${quizId}/questions/${questionId}/answers/non-existent-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /quiz/:quizId/questions/:questionId/answers/:answerId', () => {
    beforeEach(async () => {
      // Create two answers for delete tests
      const answer1Data = {
        answer_text: '3',
        is_correct: false,
        order_index: 0,
      };

      const answer2Data = {
        answer_text: '4',
        is_correct: true,
        order_index: 1,
      };

      const response1 = await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answer1Data);

      await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answer2Data);

      answerId = response1.body.id;
    });

    it('should delete answer successfully', async () => {
      await request(app)
        .delete(`/quiz/${quizId}/questions/${questionId}/answers/${answerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should reject delete for non-existent answer', async () => {
      await request(app)
        .delete(`/quiz/${quizId}/questions/${questionId}/answers/non-existent-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should reject delete of last answer', async () => {
      // First delete one answer
      await request(app)
        .delete(`/quiz/${quizId}/questions/${questionId}/answers/${answerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Get the remaining answer ID
      const { data: answers } = await supabaseAdmin
        .from('answers')
        .select('id')
        .eq('question_id', questionId);

      const remainingAnswerId = answers?.[0]?.id;

      // Try to delete the last answer
      await request(app)
        .delete(`/quiz/${quizId}/questions/${questionId}/answers/${remainingAnswerId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Answer constraint validation', () => {
    it('should enforce exactly one correct answer for multiple choice', async () => {
      // Create first answer (correct)
      const answer1Data = {
        answer_text: '4',
        is_correct: true,
        order_index: 0,
      };

      await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answer1Data)
        .expect(201);

      // Try to create second correct answer
      const answer2Data = {
        answer_text: 'Four',
        is_correct: true,
        order_index: 1,
      };

      await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answer2Data)
        .expect(400);
    });

    it('should enforce maximum 4 answers for multiple choice', async () => {
      // Create 4 answers
      for (let i = 0; i < 4; i++) {
        const answerData = {
          answer_text: `Answer ${i + 1}`,
          is_correct: i === 0, // First one is correct
          order_index: i,
        };

        await request(app)
          .post(`/quiz/${quizId}/questions/${questionId}/answers`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(answerData)
          .expect(201);
      }

      // Try to create 5th answer
      const answer5Data = {
        answer_text: 'Answer 5',
        is_correct: false,
        order_index: 4,
      };

      await request(app)
        .post(`/quiz/${quizId}/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(answer5Data)
        .expect(400);
    });
  });
});
