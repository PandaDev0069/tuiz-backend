// tests/auth.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { createTestUser, cleanupTestUsers } from './setup';

describe('Auth Routes - Basic Validation', () => {
  const app = createApp();
  const createdUserIds: string[] = [];

  // Clean up any users created during tests
  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await cleanupTestUsers(createdUserIds);
      createdUserIds.length = 0; // Clear the array
    }
  });

  describe('Input Validation', () => {
    it('should return 400 for invalid registration payload', async () => {
      const response = await request(app).post('/auth/register').send({
        email: 'invalid-email',
        password: '123', // too short
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_payload');
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for missing required registration fields', async () => {
      const response = await request(app).post('/auth/register').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_payload');
    });

    it('should return 400 for invalid login payload', async () => {
      const response = await request(app).post('/auth/login').send({
        email: 'invalid-email',
        password: '',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_payload');
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for missing required login fields', async () => {
      const response = await request(app).post('/auth/login').send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'invalid_payload');
    });
  });

  describe('Authentication Tests', () => {
    it('should successfully register and handle duplicate email error', async () => {
      const testUser = createTestUser('duplicate');

      // First registration
      const firstResponse = await request(app).post('/auth/register').send({
        email: testUser.email,
        password: testUser.password,
        username: testUser.username,
        displayName: testUser.displayName,
      });

      expect(firstResponse.status).toBe(201);
      expect(firstResponse.body).toHaveProperty('user');
      expect(firstResponse.body).toHaveProperty('session');

      createdUserIds.push(firstResponse.body.user.id);

      // Wait shorter time - just enough to avoid rate limits but not long enough for cleanup
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Attempt duplicate registration with same email
      const duplicateResponse = await request(app)
        .post('/auth/register')
        .send({
          email: testUser.email, // Same email
          password: 'differentpassword123',
          username: `${testUser.username}_diff`, // Different username to avoid conflict
          displayName: 'Different Name',
        });

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body).toHaveProperty('error', 'duplicate_email');
      expect(duplicateResponse.body).toHaveProperty(
        'message',
        'An account with this email already exists',
      );
    });

    it('should return 401 for invalid credentials', async () => {
      const testUser = createTestUser('nonexistent');

      const response = await request(app).post('/auth/login').send({
        email: testUser.email,
        password: 'wrongpassword123',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'invalid_credentials');
      expect(response.body).toHaveProperty('message', 'Invalid email or password');
    });
  });

  describe('Authorization Tests', () => {
    it('should return 401 for missing authorization header', async () => {
      const response = await request(app).post('/auth/logout').send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'unauthorized');
      expect(response.body).toHaveProperty('message', 'No valid session token provided');
    });

    it('should return 401 for invalid authorization header', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'InvalidToken')
        .send({});

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'unauthorized');
      expect(response.body).toHaveProperty('message', 'No valid session token provided');
    });
  });
});
