// tests/questions.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { supabaseAdmin } from '../src/lib/supabase';
import { QuestionType, DifficultyLevel } from '../src/types/quiz';

const app = createApp();

describe('Question API', () => {
  let authToken: string;
  let userId: string;
  let quizId: string;
  let questionId: string;

  beforeEach(async () => {
    // Create a test user and get auth token
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'test@example.com',
      password: 'testpassword123',
      email_confirm: true,
    });

    if (authError) throw authError;
    userId = authData.user.id;

    // Get auth token - using a mock token for testing
    authToken = 'mock-jwt-token-for-testing';

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
  });

  afterEach(async () => {
    // Clean up test data
    if (quizId) {
      await supabaseAdmin.from('quiz_sets').delete().eq('id', quizId);
    }
    if (userId) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
  });

  describe('POST /quiz/:quizId/questions', () => {
    it('should create a question successfully', async () => {
      const questionData = {
        question_text: 'What is 2 + 2?',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        explanation_title: 'Math Explanation',
        explanation_text: '2 + 2 equals 4',
        show_explanation_time: 5,
        answers: [
          { answer_text: '3', is_correct: false, order_index: 0 },
          { answer_text: '4', is_correct: true, order_index: 1 },
          { answer_text: '5', is_correct: false, order_index: 2 },
        ],
      };

      const response = await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body).toMatchObject({
        question_text: questionData.question_text,
        question_type: questionData.question_type,
        points: questionData.points,
        difficulty: questionData.difficulty,
        order_index: questionData.order_index,
      });
      expect(response.body.id).toBeDefined();
      questionId = response.body.id;
    });

    it('should create a true/false question successfully', async () => {
      const questionData = {
        question_text: 'Is the sky blue?',
        question_type: QuestionType.TRUE_FALSE,
        show_question_time: 5,
        answering_time: 15,
        points: 5,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 3,
        answers: [
          { answer_text: 'True', is_correct: true, order_index: 0 },
          { answer_text: 'False', is_correct: false, order_index: 1 },
        ],
      };

      const response = await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(201);

      expect(response.body.question_type).toBe(QuestionType.TRUE_FALSE);
      questionId = response.body.id;
    });

    it('should reject question with invalid answer count for true/false', async () => {
      const questionData = {
        question_text: 'Is the sky blue?',
        question_type: QuestionType.TRUE_FALSE,
        show_question_time: 5,
        answering_time: 15,
        points: 5,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 3,
        answers: [
          { answer_text: 'True', is_correct: true, order_index: 0 },
          { answer_text: 'False', is_correct: false, order_index: 1 },
          { answer_text: 'Maybe', is_correct: false, order_index: 2 },
        ],
      };

      await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(400);
    });

    it('should reject question with no correct answers', async () => {
      const questionData = {
        question_text: 'What is 2 + 2?',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 5,
        answers: [
          { answer_text: '3', is_correct: false, order_index: 0 },
          { answer_text: '4', is_correct: false, order_index: 1 },
        ],
      };

      await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(400);
    });

    it('should reject question with multiple correct answers', async () => {
      const questionData = {
        question_text: 'What is 2 + 2?',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 5,
        answers: [
          { answer_text: '4', is_correct: true, order_index: 0 },
          { answer_text: '4', is_correct: true, order_index: 1 },
        ],
      };

      await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(400);
    });

    it('should reject request for non-existent quiz', async () => {
      const questionData = {
        question_text: 'What is 2 + 2?',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 5,
        answers: [
          { answer_text: '3', is_correct: false, order_index: 0 },
          { answer_text: '4', is_correct: true, order_index: 1 },
        ],
      };

      await request(app)
        .post('/quiz/non-existent-id/questions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData)
        .expect(404);
    });
  });

  describe('PUT /quiz/:quizId/questions/:questionId', () => {
    beforeEach(async () => {
      // Create a question for update tests
      const questionData = {
        question_text: 'What is 2 + 2?',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 5,
        answers: [
          { answer_text: '3', is_correct: false, order_index: 0 },
          { answer_text: '4', is_correct: true, order_index: 1 },
        ],
      };

      const response = await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      questionId = response.body.id;
    });

    it('should update question successfully', async () => {
      const updateData = {
        id: questionId,
        question_set_id: quizId,
        question_text: 'What is 3 + 3?',
        points: 15,
        answers: [
          { answer_text: '5', is_correct: false, order_index: 0 },
          { answer_text: '6', is_correct: true, order_index: 1 },
        ],
      };

      const response = await request(app)
        .put(`/quiz/${quizId}/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.question_text).toBe('What is 3 + 3?');
      expect(response.body.points).toBe(15);
    });

    it('should reject update for non-existent question', async () => {
      const updateData = {
        id: 'non-existent-id',
        question_set_id: quizId,
        question_text: 'What is 3 + 3?',
      };

      await request(app)
        .put(`/quiz/${quizId}/questions/non-existent-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /quiz/:quizId/questions/:questionId', () => {
    beforeEach(async () => {
      // Create a question for delete tests
      const questionData = {
        question_text: 'What is 2 + 2?',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 5,
        answers: [
          { answer_text: '3', is_correct: false, order_index: 0 },
          { answer_text: '4', is_correct: true, order_index: 1 },
        ],
      };

      const response = await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionData);

      questionId = response.body.id;
    });

    it('should delete question successfully', async () => {
      await request(app)
        .delete(`/quiz/${quizId}/questions/${questionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);
    });

    it('should reject delete for non-existent question', async () => {
      await request(app)
        .delete(`/quiz/${quizId}/questions/non-existent-id`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PUT /quiz/:quizId/questions/reorder', () => {
    let questionId1: string;
    let questionId2: string;

    beforeEach(async () => {
      // Create two questions for reorder tests
      const question1Data = {
        question_text: 'Question 1',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 0,
        show_explanation_time: 5,
        answers: [
          { answer_text: 'A', is_correct: false, order_index: 0 },
          { answer_text: 'B', is_correct: true, order_index: 1 },
        ],
      };

      const question2Data = {
        question_text: 'Question 2',
        question_type: QuestionType.MULTIPLE_CHOICE,
        show_question_time: 10,
        answering_time: 30,
        points: 10,
        difficulty: DifficultyLevel.EASY,
        order_index: 1,
        show_explanation_time: 5,
        answers: [
          { answer_text: 'C', is_correct: false, order_index: 0 },
          { answer_text: 'D', is_correct: true, order_index: 1 },
        ],
      };

      const response1 = await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(question1Data);

      const response2 = await request(app)
        .post(`/quiz/${quizId}/questions`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(question2Data);

      questionId1 = response1.body.id;
      questionId2 = response2.body.id;
    });

    it('should reorder questions successfully', async () => {
      const reorderData = {
        questionIds: [questionId2, questionId1], // Reverse the order
      };

      await request(app)
        .put(`/quiz/${quizId}/questions/reorder`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reorderData)
        .expect(200);
    });

    it('should reject reorder with empty questionIds', async () => {
      const reorderData = {
        questionIds: [],
      };

      await request(app)
        .put(`/quiz/${quizId}/questions/reorder`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reorderData)
        .expect(400);
    });
  });
});
