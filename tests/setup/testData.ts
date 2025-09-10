/**
 * Test Data Factories
 *
 * Provides factories for generating consistent test data across all tests.
 * Each factory creates realistic data that matches the database schema.
 */

import type { DifficultyLevel, QuizStatus, QuestionType } from '../../src/types/quiz';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TestQuizSetData {
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  category: string;
  tags: string[];
  is_public: boolean;
  play_settings: Record<string, unknown>;
  status: QuizStatus;
  thumbnail_url?: string;
}

export interface TestQuestionData {
  question_text: string;
  question_type: QuestionType;
  explanation?: string;
  order_index: number;
  time_limit?: number;
  points?: number;
  image_url?: string;
}

export interface TestAnswerData {
  answer_text: string;
  is_correct: boolean;
  order_index: number;
  image_url?: string;
}

export interface TestUserData {
  email: string;
  username: string;
  display_name: string;
  role: 'user' | 'admin';
}

// ============================================================================
// QUIZ DATA FACTORIES
// ============================================================================

export class QuizDataFactory {
  private static counter = 0;

  /**
   * Create a basic quiz set for testing
   */
  static createQuizSet(overrides: Partial<TestQuizSetData> = {}): TestQuizSetData {
    this.counter++;

    return {
      title: `Test Quiz ${this.counter}`,
      description: `This is a test quiz created for testing purposes. Quiz #${this.counter}`,
      difficulty: 'MEDIUM' as DifficultyLevel,
      category: 'General Knowledge',
      tags: ['test', 'sample'],
      is_public: true,
      play_settings: {
        time_per_question: 30,
        show_correct_answers: true,
        allow_retry: false,
        shuffle_questions: true,
        shuffle_answers: true,
      },
      status: 'DRAFT' as QuizStatus,
      thumbnail_url: `https://example.com/quiz-${this.counter}.jpg`,
      ...overrides,
    };
  }

  /**
   * Create a quiz set with specific difficulty
   */
  static createEasyQuiz(overrides: Partial<TestQuizSetData> = {}): TestQuizSetData {
    return this.createQuizSet({
      difficulty: 'EASY' as DifficultyLevel,
      title: `Easy Quiz ${this.counter}`,
      ...overrides,
    });
  }

  /**
   * Create a quiz set with hard difficulty
   */
  static createHardQuiz(overrides: Partial<TestQuizSetData> = {}): TestQuizSetData {
    return this.createQuizSet({
      difficulty: 'HARD' as DifficultyLevel,
      title: `Hard Quiz ${this.counter}`,
      ...overrides,
    });
  }

  /**
   * Create a published quiz
   */
  static createPublishedQuiz(overrides: Partial<TestQuizSetData> = {}): TestQuizSetData {
    return this.createQuizSet({
      status: 'PUBLISHED' as QuizStatus,
      is_public: true,
      ...overrides,
    });
  }

  /**
   * Create a private quiz
   */
  static createPrivateQuiz(overrides: Partial<TestQuizSetData> = {}): TestQuizSetData {
    return this.createQuizSet({
      is_public: false,
      status: 'DRAFT' as QuizStatus,
      ...overrides,
    });
  }

  /**
   * Create a quiz with specific category
   */
  static createQuizWithCategory(
    category: string,
    overrides: Partial<TestQuizSetData> = {},
  ): TestQuizSetData {
    return this.createQuizSet({
      category,
      tags: [category.toLowerCase()],
      ...overrides,
    });
  }

  /**
   * Create a quiz with custom play settings
   */
  static createQuizWithSettings(
    playSettings: Record<string, unknown>,
    overrides: Partial<TestQuizSetData> = {},
  ): TestQuizSetData {
    return this.createQuizSet({
      play_settings: playSettings,
      ...overrides,
    });
  }
}

// ============================================================================
// QUESTION DATA FACTORIES
// ============================================================================

export class QuestionDataFactory {
  private static counter = 0;

  /**
   * Create a basic multiple choice question
   */
  static createMultipleChoiceQuestion(overrides: Partial<TestQuestionData> = {}): TestQuestionData {
    this.counter++;

    return {
      question_text: `What is the capital of Test Country ${this.counter}?`,
      question_type: 'MULTIPLE_CHOICE' as QuestionType,
      explanation: `The capital of Test Country ${this.counter} is Test City.`,
      order_index: this.counter,
      time_limit: 30,
      points: 10,
      image_url: `https://example.com/question-${this.counter}.jpg`,
      ...overrides,
    };
  }

  /**
   * Create a true/false question
   */
  static createTrueFalseQuestion(overrides: Partial<TestQuestionData> = {}): TestQuestionData {
    this.counter++;

    return {
      question_text: `Test statement ${this.counter} is true.`,
      question_type: 'TRUE_FALSE' as QuestionType,
      explanation: `This statement is true because of test reason ${this.counter}.`,
      order_index: this.counter,
      time_limit: 15,
      points: 5,
      ...overrides,
    };
  }

  /**
   * Create a question with specific difficulty
   */
  static createQuestionWithDifficulty(
    difficulty: 'EASY' | 'MEDIUM' | 'HARD',
    overrides: Partial<TestQuestionData> = {},
  ): TestQuestionData {
    const timeLimits: Record<string, number> = { EASY: 60, MEDIUM: 30, HARD: 15 };
    const points: Record<string, number> = { EASY: 5, MEDIUM: 10, HARD: 20 };

    return this.createMultipleChoiceQuestion({
      time_limit: timeLimits[difficulty],
      points: points[difficulty],
      ...overrides,
    });
  }

  /**
   * Create a question with image
   */
  static createQuestionWithImage(
    imageUrl: string,
    overrides: Partial<TestQuestionData> = {},
  ): TestQuestionData {
    return this.createMultipleChoiceQuestion({
      image_url: imageUrl,
      ...overrides,
    });
  }

  /**
   * Create a question with long explanation
   */
  static createQuestionWithLongExplanation(
    overrides: Partial<TestQuestionData> = {},
  ): TestQuestionData {
    this.counter++;

    return this.createMultipleChoiceQuestion({
      question_text: `Complex question ${this.counter} with multiple parts?`,
      explanation: `This is a detailed explanation for question ${this.counter}. It includes multiple paragraphs and covers various aspects of the topic. The explanation provides comprehensive information to help users understand the correct answer and the reasoning behind it.`,
      ...overrides,
    });
  }
}

// ============================================================================
// ANSWER DATA FACTORIES
// ============================================================================

export class AnswerDataFactory {
  private static counter = 0;

  /**
   * Create a correct answer
   */
  static createCorrectAnswer(overrides: Partial<TestAnswerData> = {}): TestAnswerData {
    this.counter++;

    return {
      answer_text: `Correct Answer ${this.counter}`,
      is_correct: true,
      order_index: this.counter,
      image_url: `https://example.com/correct-${this.counter}.jpg`,
      ...overrides,
    };
  }

  /**
   * Create an incorrect answer
   */
  static createIncorrectAnswer(overrides: Partial<TestAnswerData> = {}): TestAnswerData {
    this.counter++;

    return {
      answer_text: `Incorrect Answer ${this.counter}`,
      is_correct: false,
      order_index: this.counter,
      image_url: `https://example.com/incorrect-${this.counter}.jpg`,
      ...overrides,
    };
  }

  /**
   * Create a set of answers for a multiple choice question
   */
  static createMultipleChoiceAnswers(
    correctAnswer: string,
    incorrectAnswers: string[],
  ): TestAnswerData[] {
    const answers: TestAnswerData[] = [];
    let orderIndex = 1;

    // Add correct answer
    answers.push({
      answer_text: correctAnswer,
      is_correct: true,
      order_index: orderIndex++,
    });

    // Add incorrect answers
    incorrectAnswers.forEach((text) => {
      answers.push({
        answer_text: text,
        is_correct: false,
        order_index: orderIndex++,
      });
    });

    return answers;
  }

  /**
   * Create answers for a true/false question
   */
  static createTrueFalseAnswers(isTrue: boolean): TestAnswerData[] {
    return [
      {
        answer_text: 'True',
        is_correct: isTrue,
        order_index: 1,
      },
      {
        answer_text: 'False',
        is_correct: !isTrue,
        order_index: 2,
      },
    ];
  }

  /**
   * Create answers with images
   */
  static createAnswersWithImages(correctText: string, incorrectTexts: string[]): TestAnswerData[] {
    const answers = this.createMultipleChoiceAnswers(correctText, incorrectTexts);

    answers.forEach((answer, index) => {
      answer.image_url = `https://example.com/answer-${index + 1}.jpg`;
    });

    return answers;
  }
}

// ============================================================================
// USER DATA FACTORIES
// ============================================================================

export class UserDataFactory {
  private static counter = 0;

  /**
   * Create a basic test user
   */
  static createUser(overrides: Partial<TestUserData> = {}): TestUserData {
    this.counter++;

    return {
      email: `testuser${this.counter}@example.com`,
      username: `testuser${this.counter}`,
      display_name: `Test User ${this.counter}`,
      role: 'user',
      ...overrides,
    };
  }

  /**
   * Create an admin user
   */
  static createAdminUser(overrides: Partial<TestUserData> = {}): TestUserData {
    return this.createUser({
      role: 'admin',
      username: `admin${this.counter}`,
      display_name: `Admin User ${this.counter}`,
      ...overrides,
    });
  }

  /**
   * Create a user with specific email domain
   */
  static createUserWithDomain(domain: string, overrides: Partial<TestUserData> = {}): TestUserData {
    return this.createUser({
      email: `testuser${this.counter}@${domain}`,
      ...overrides,
    });
  }
}

// ============================================================================
// COMPLETE QUIZ FACTORIES
// ============================================================================

export class CompleteQuizFactory {
  /**
   * Create a complete quiz with questions and answers
   */
  static createCompleteQuiz(
    overrides: {
      quiz?: Partial<TestQuizSetData>;
      questionCount?: number;
      answersPerQuestion?: number;
    } = {},
  ): {
    quiz: TestQuizSetData;
    questions: TestQuestionData[];
    answers: TestAnswerData[][];
  } {
    const { quiz: quizOverrides = {}, questionCount = 3 } = overrides;

    const quiz = QuizDataFactory.createQuizSet(quizOverrides);
    const questions: TestQuestionData[] = [];
    const answers: TestAnswerData[][] = [];

    for (let i = 0; i < questionCount; i++) {
      const question = QuestionDataFactory.createMultipleChoiceQuestion({
        order_index: i + 1,
        question_text: `Question ${i + 1}: What is the correct answer?`,
      });
      questions.push(question);

      const questionAnswers = AnswerDataFactory.createMultipleChoiceAnswers(
        `Correct Answer ${i + 1}`,
        [`Wrong Answer A ${i + 1}`, `Wrong Answer B ${i + 1}`, `Wrong Answer C ${i + 1}`],
      );
      answers.push(questionAnswers);
    }

    return { quiz, questions, answers };
  }

  /**
   * Create a quiz with mixed question types
   */
  static createMixedQuiz(
    overrides: {
      quiz?: Partial<TestQuizSetData>;
      multipleChoiceCount?: number;
      trueFalseCount?: number;
    } = {},
  ): {
    quiz: TestQuizSetData;
    questions: TestQuestionData[];
    answers: TestAnswerData[][];
  } {
    const { quiz: quizOverrides = {}, multipleChoiceCount = 2, trueFalseCount = 2 } = overrides;

    const quiz = QuizDataFactory.createQuizSet(quizOverrides);
    const questions: TestQuestionData[] = [];
    const answers: TestAnswerData[][] = [];
    let orderIndex = 1;

    // Add multiple choice questions
    for (let i = 0; i < multipleChoiceCount; i++) {
      const question = QuestionDataFactory.createMultipleChoiceQuestion({
        order_index: orderIndex++,
        question_text: `Multiple Choice Question ${i + 1}`,
      });
      questions.push(question);

      const questionAnswers = AnswerDataFactory.createMultipleChoiceAnswers(
        `Correct Answer ${i + 1}`,
        [`Wrong A ${i + 1}`, `Wrong B ${i + 1}`, `Wrong C ${i + 1}`],
      );
      answers.push(questionAnswers);
    }

    // Add true/false questions
    for (let i = 0; i < trueFalseCount; i++) {
      const question = QuestionDataFactory.createTrueFalseQuestion({
        order_index: orderIndex++,
        question_text: `True/False Statement ${i + 1}`,
      });
      questions.push(question);

      const questionAnswers = AnswerDataFactory.createTrueFalseAnswers(i % 2 === 0);
      answers.push(questionAnswers);
    }

    return { quiz, questions, answers };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Reset all factory counters (useful for test isolation)
 */
export function resetFactoryCounters(): void {
  QuizDataFactory['counter'] = 0;
  QuestionDataFactory['counter'] = 0;
  AnswerDataFactory['counter'] = 0;
  UserDataFactory['counter'] = 0;
}

/**
 * Generate a random string for unique identifiers
 */
export function generateRandomString(length: number = 8): string {
  return Math.random().toString(36).substr(2, length);
}

/**
 * Generate a random email
 */
export function generateRandomEmail(domain: string = 'example.com'): string {
  return `test-${generateRandomString()}-${Date.now()}@${domain}`;
}

/**
 * Generate a random username
 */
export function generateRandomUsername(): string {
  return `user_${generateRandomString()}_${Date.now()}`;
}
