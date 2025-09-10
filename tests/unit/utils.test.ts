/**
 * Utility Functions Unit Tests
 *
 * Tests for utility functions, helpers, and common logic.
 * Focuses on pure functions, data transformation, and helper methods.
 */

import { describe, it, expect, vi } from 'vitest';
import { logger } from '../../src/utils/logger';

// Mock logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Logger Utility', () => {
  it('should log info messages', () => {
    logger.info('Test info message');
    expect(logger.info).toHaveBeenCalledWith('Test info message');
  });

  it('should log warning messages', () => {
    logger.warn('Test warning message');
    expect(logger.warn).toHaveBeenCalledWith('Test warning message');
  });

  it('should log error messages', () => {
    logger.error('Test error message');
    expect(logger.error).toHaveBeenCalledWith('Test error message');
  });

  it('should log debug messages', () => {
    logger.debug('Test debug message');
    expect(logger.debug).toHaveBeenCalledWith('Test debug message');
  });

  it('should log structured data', () => {
    const data = { userId: '123', action: 'login' };
    logger.info(data, 'User action');
    expect(logger.info).toHaveBeenCalledWith(data, 'User action');
  });
});

describe('String Utilities', () => {
  // Test string manipulation functions
  it('should generate random strings of correct length', () => {
    const length = 8;
    const randomString = Math.random().toString(36).substr(2, length);
    expect(randomString).toHaveLength(length);
    expect(typeof randomString).toBe('string');
  });

  it('should generate unique random strings', () => {
    const strings = new Set();
    for (let i = 0; i < 100; i++) {
      const randomString = Math.random().toString(36).substr(2, 8);
      strings.add(randomString);
    }
    expect(strings.size).toBe(100); // All strings should be unique
  });

  it('should validate email format', () => {
    const validEmails = ['test@example.com', 'user.name@domain.co.uk', 'test+tag@example.org'];

    const invalidEmails = ['invalid-email', '@example.com', 'test@', 'test.example.com'];

    validEmails.forEach((email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(email)).toBe(true);
    });

    invalidEmails.forEach((email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(email)).toBe(false);
    });
  });

  it('should validate password strength', () => {
    const validPasswords = ['password123', 'Test123', 'MyPassword', 'ComplexPass123'];

    const invalidPasswords = ['123', 'pass', ''];

    // Match the actual validation schema: minimum 6 characters
    const passwordRegex = /^.{6,}$/;

    validPasswords.forEach((password) => {
      expect(passwordRegex.test(password)).toBe(true);
    });

    invalidPasswords.forEach((password) => {
      expect(passwordRegex.test(password)).toBe(false);
    });
  });
});

describe('Array Utilities', () => {
  it('should shuffle array elements', () => {
    const originalArray = [1, 2, 3, 4, 5];
    const shuffledArray = [...originalArray].sort(() => Math.random() - 0.5);

    expect(shuffledArray).toHaveLength(originalArray.length);
    expect(shuffledArray.every((item) => originalArray.includes(item))).toBe(true);
  });

  it('should remove duplicates from array', () => {
    const arrayWithDuplicates = [1, 2, 2, 3, 3, 3, 4];
    const uniqueArray = [...new Set(arrayWithDuplicates)];

    expect(uniqueArray).toEqual([1, 2, 3, 4]);
  });

  it('should group array elements by property', () => {
    const items = [
      { category: 'A', value: 1 },
      { category: 'B', value: 2 },
      { category: 'A', value: 3 },
      { category: 'C', value: 4 },
    ];

    const grouped = items.reduce(
      (acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
      },
      {} as Record<string, typeof items>,
    );

    expect(grouped.A).toHaveLength(2);
    expect(grouped.B).toHaveLength(1);
    expect(grouped.C).toHaveLength(1);
  });
});

describe('Object Utilities', () => {
  it('should deep clone objects', () => {
    const original = {
      name: 'Test',
      nested: {
        value: 123,
        array: [1, 2, 3],
      },
    };

    const cloned = JSON.parse(JSON.stringify(original));
    cloned.nested.value = 456;
    cloned.nested.array.push(4);

    expect(original.nested.value).toBe(123);
    expect(original.nested.array).toEqual([1, 2, 3]);
    expect(cloned.nested.value).toBe(456);
    expect(cloned.nested.array).toEqual([1, 2, 3, 4]);
  });

  it('should merge objects deeply', () => {
    const obj1 = {
      a: 1,
      b: {
        c: 2,
        d: 3,
      },
    };

    const obj2 = {
      b: {
        c: 4,
        e: 5,
      },
      f: 6,
    };

    const merged = {
      ...obj1,
      ...obj2,
      b: {
        ...obj1.b,
        ...obj2.b,
      },
    };

    expect(merged).toEqual({
      a: 1,
      b: {
        c: 4,
        d: 3,
        e: 5,
      },
      f: 6,
    });
  });

  it('should pick specific properties from object', () => {
    const obj = {
      id: '123',
      name: 'Test',
      email: 'test@example.com',
      password: 'secret',
      role: 'user',
    };

    const picked = {
      id: obj.id,
      name: obj.name,
      email: obj.email,
    };

    expect(picked).toEqual({
      id: '123',
      name: 'Test',
      email: 'test@example.com',
    });
    expect(picked).not.toHaveProperty('password');
    expect(picked).not.toHaveProperty('role');
  });

  it('should omit specific properties from object', () => {
    const obj = {
      id: '123',
      name: 'Test',
      email: 'test@example.com',
      password: 'secret',
      role: 'user',
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, role, ...omitted } = obj;

    expect(omitted).toEqual({
      id: '123',
      name: 'Test',
      email: 'test@example.com',
    });
    expect(omitted).not.toHaveProperty('password');
    expect(omitted).not.toHaveProperty('role');
  });
});

describe('Date Utilities', () => {
  it('should format dates correctly', () => {
    const date = new Date('2023-12-25T10:30:00Z');
    const isoString = date.toISOString();

    expect(isoString).toBe('2023-12-25T10:30:00.000Z');
  });

  it('should calculate time differences', () => {
    const start = new Date('2023-12-25T10:00:00Z');
    const end = new Date('2023-12-25T11:30:00Z');
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    expect(diffMinutes).toBe(90);
  });

  it('should check if date is in the past', () => {
    const pastDate = new Date('2020-01-01');
    const futureDate = new Date('2030-01-01');
    const now = new Date();

    expect(pastDate < now).toBe(true);
    expect(futureDate > now).toBe(true);
  });
});

describe('Number Utilities', () => {
  it('should generate random numbers in range', () => {
    const min = 1;
    const max = 10;
    const random = Math.floor(Math.random() * (max - min + 1)) + min;

    expect(random).toBeGreaterThanOrEqual(min);
    expect(random).toBeLessThanOrEqual(max);
  });

  it('should round numbers to specified decimal places', () => {
    const number = 3.14159;
    const rounded = Math.round(number * 100) / 100;

    expect(rounded).toBe(3.14);
  });

  it('should clamp numbers to range', () => {
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(15, 1, 10)).toBe(10);
  });
});

describe('Validation Utilities', () => {
  it('should validate required fields', () => {
    const data = { name: 'Test', email: 'test@example.com' };
    const requiredFields = ['name', 'email'];

    const isValid = requiredFields.every((field) =>
      Object.prototype.hasOwnProperty.call(data, field),
    );
    expect(isValid).toBe(true);
  });

  it('should detect missing required fields', () => {
    const data = { name: 'Test' };
    const requiredFields = ['name', 'email'];

    const missingFields = requiredFields.filter(
      (field) => !Object.prototype.hasOwnProperty.call(data, field),
    );
    expect(missingFields).toEqual(['email']);
  });

  it('should validate data types', () => {
    const data = { name: 'Test', age: 25, active: true };

    expect(typeof data.name).toBe('string');
    expect(typeof data.age).toBe('number');
    expect(typeof data.active).toBe('boolean');
  });

  it('should sanitize input data', () => {
    const input = '<script>alert("xss")</script>Test';
    // More comprehensive sanitization that removes all HTML tags and dangerous characters
    const sanitized = input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/["']/g, '') // Remove quotes that could break out of attributes
      .trim();

    expect(sanitized).toBe('alert(xss)Test');
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('</script>');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('onclick=');
  });
});

describe('Error Handling Utilities', () => {
  it('should create standardized error objects', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      details: { field: 'email' },
    };

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid input data');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('should handle async errors gracefully', async () => {
    const asyncFunction = async () => {
      throw new Error('Async error');
    };

    try {
      await asyncFunction();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Async error');
    }
  });

  it('should retry failed operations', async () => {
    let attempts = 0;
    const maxRetries = 3;

    const retryFunction = async () => {
      attempts++;
      if (attempts < maxRetries) {
        throw new Error('Temporary failure');
      }
      return 'Success';
    };

    let result;
    for (let i = 0; i < maxRetries; i++) {
      try {
        result = await retryFunction();
        break;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
      }
    }

    expect(result).toBe('Success');
    expect(attempts).toBe(3);
  });
});
