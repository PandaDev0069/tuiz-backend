import request from 'supertest';
import { createApp } from '../src/app';
import { describe, it, expect } from 'vitest';

describe('Not Found', () => {
  const app = createApp();

  it('returns unified error contract on unknown route', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: 'not_found',
      message: expect.any(String),
    });
  });
});
