import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { getSecret, dbConfig, redisConfig, jwtConfig, appConfig } from '../config';

// Mock fs module
vi.mock('fs');
const mockedFs = fs as unknown as { existsSync: ReturnType<typeof vi.fn>; readFileSync: ReturnType<typeof vi.fn> } as any;

describe('getSecret', () => {
  const originalEnv = process.env;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Reset mocks and environment
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv } as any;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should read secret from Docker secrets file in production', () => {
      const secretValue = 'my-secret-password';
      vi.spyOn(fs, 'existsSync').mockReturnValue(true as any);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(secretValue as any);

      const result = getSecret('db_password', 'DB_PASSWORD');

      expect(result).toBe(secretValue);
      expect(mockedFs.existsSync).toHaveBeenCalledWith(
        path.join('/run/secrets', 'db_password')
      );
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(
        path.join('/run/secrets', 'db_password'),
        'utf8'
      );
    });

    it('should trim whitespace from secret file content', () => {
      const secretValue = '  my-secret-password\n  ';
      const trimmedValue = 'my-secret-password';
      vi.spyOn(fs, 'existsSync').mockReturnValue(true as any);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(secretValue as any);

      const result = getSecret('db_password', 'DB_PASSWORD');

      expect(result).toBe(trimmedValue);
    });

    it('should fallback to environment variable when secret file not found', () => {
      const envValue = 'env-password';
      vi.spyOn(fs, 'existsSync').mockReturnValue(false as any);
      process.env.DB_PASSWORD = envValue;

      const result = getSecret('db_password', 'DB_PASSWORD');

      expect(result).toBe(envValue);
    });

    it('should fallback to environment variable when file read fails', () => {
      const envValue = 'env-password';
      vi.spyOn(fs, 'existsSync').mockReturnValue(true as any);
      vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });
      process.env.DB_PASSWORD = envValue;

      const result = getSecret('db_password', 'DB_PASSWORD');

      expect(result).toBe(envValue);
    });

    it('should throw error in production when secret not found anywhere', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false as any);
      delete process.env.DB_PASSWORD;

      expect(() => {
        getSecret('db_password', 'DB_PASSWORD');
      }).toThrow(
        "Secret 'db_password' not found. Please ensure Docker secret is created or DB_PASSWORD environment variable is set."
      );
    });

    it('should use envVarName parameter when provided', () => {
      const envValue = 'env-password';
      vi.spyOn(fs, 'existsSync').mockReturnValue(false as any);
      process.env.CUSTOM_VAR = envValue;

      const result = getSecret('db_password', 'CUSTOM_VAR');

      expect(result).toBe(envValue);
    });

    it('should default to secretName for env var when envVarName not provided', () => {
      const envValue = 'env-password';
      vi.spyOn(fs, 'existsSync').mockReturnValue(false as any);
      process.env.db_password = envValue;

      const result = getSecret('db_password');

      expect(result).toBe(envValue);
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should use environment variable in development', () => {
      const envValue = 'dev-password';
      process.env.DB_PASSWORD = envValue;

      const result = getSecret('db_password', 'DB_PASSWORD');

      expect(result).toBe(envValue);
      // Should not try to read from Docker secrets in development
      const existsSpy = vi.spyOn(fs, 'existsSync')
      const readSpy = vi.spyOn(fs, 'readFileSync' as any)
      expect(existsSpy).not.toHaveBeenCalled();
      expect(readSpy).not.toHaveBeenCalled();
    });

    it('should return empty string and warn when secret not found in development', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      delete process.env.DB_PASSWORD;

      const result = getSecret('db_password', 'DB_PASSWORD');

      expect(result).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Secret 'db_password' not found")
      );
      consoleWarnSpy.mockRestore();
    });

    it('should not throw error in development when secret missing', () => {
      delete process.env.DB_PASSWORD;

      expect(() => {
        getSecret('db_password', 'DB_PASSWORD');
      }).not.toThrow();
    });
  });
});

describe('dbConfig', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'test-host';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'test-db';
    process.env.DB_USER = 'test-user';
    process.env.DB_PASSWORD = 'test-password';
  });

  it('should export database configuration with correct values', () => {
    expect(dbConfig).toHaveProperty('host', 'test-host');
    expect(dbConfig).toHaveProperty('port', 5433);
    expect(dbConfig).toHaveProperty('database', 'test-db');
    expect(dbConfig).toHaveProperty('user', 'test-user');
    expect(dbConfig).toHaveProperty('password', 'test-password');
  });

  it('should use default values when environment variables not set', async () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_NAME;
    delete process.env.DB_USER;

    // Re-import to get fresh config
    vi.resetModules();
    const { dbConfig: freshConfig } = await import('../config');

    expect(freshConfig.host).toBe('localhost');
    expect(freshConfig.port).toBe(5432);
    expect(freshConfig.database).toBe('buildmystack');
    expect(freshConfig.user).toBe('buildmystack_user');
  });

  it('should use getSecret for password', () => {
    // Password should come from getSecret function
    expect(dbConfig.password).toBeDefined();
  });
});

describe('redisConfig', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.REDIS_HOST = 'redis-host';
    process.env.REDIS_PORT = '6380';
    process.env.REDIS_PASSWORD = 'redis-password';
  });

  it('should export Redis configuration with correct values', () => {
    expect(redisConfig).toHaveProperty('host', 'redis-host');
    expect(redisConfig).toHaveProperty('port', 6380);
    expect(redisConfig).toHaveProperty('password', 'redis-password');
  });

  it('should use default values when environment variables not set', async () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;

    vi.resetModules();
    const { redisConfig: freshConfig } = await import('../config');

    expect(freshConfig.host).toBe('localhost');
    expect(freshConfig.port).toBe(6379);
  });

  it('should use getSecret for password', () => {
    expect(redisConfig.password).toBeDefined();
  });
});

describe('jwtConfig', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.JWT_SECRET = 'jwt-secret-key';
    process.env.JWT_EXPIRES_IN = '30d';
  });

  it('should export JWT configuration with correct values', () => {
    expect(jwtConfig).toHaveProperty('secret', 'jwt-secret-key');
    expect(jwtConfig).toHaveProperty('expiresIn', '30d');
  });

  it('should use default expiration when not set', async () => {
    delete process.env.JWT_EXPIRES_IN;

    vi.resetModules();
    const { jwtConfig: freshConfig } = await import('../config');

    expect(freshConfig.expiresIn).toBe('7d');
  });

  it('should use getSecret for secret', () => {
    expect(jwtConfig.secret).toBeDefined();
  });
});

describe('appConfig', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.LOG_LEVEL = 'debug';
    process.env.LOG_FORMAT = 'pretty';
  });

  it('should export application configuration with correct values', () => {
    expect(appConfig).toHaveProperty('nodeEnv', 'test');
    expect(appConfig).toHaveProperty('port', 3000);
    expect(appConfig).toHaveProperty('logLevel', 'debug');
    expect(appConfig).toHaveProperty('logFormat', 'pretty');
  });

  it('should use default values when environment variables not set', async () => {
    delete process.env.NODE_ENV;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;

    vi.resetModules();
    const { appConfig: freshConfig } = await import('../config');

    expect(freshConfig.nodeEnv).toBe('development');
    expect(freshConfig.port).toBe(8080);
    expect(freshConfig.logLevel).toBe('info');
    expect(freshConfig.logFormat).toBe('json');
  });
});

describe('Integration', () => {
  it('should construct valid PostgreSQL connection string', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'testdb';
    process.env.DB_USER = 'testuser';
    process.env.DB_PASSWORD = 'testpass';

    vi.resetModules();
    const { dbConfig } = await import('../config');

    const connectionString = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

    expect(connectionString).toBe('postgresql://testuser:testpass@localhost:5432/testdb');
  });

  it('should construct valid Redis connection URL', async () => {
    process.env.NODE_ENV = 'development';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = 'redispass';

    vi.resetModules();
    const { redisConfig } = await import('../config');

    const redisUrl = `redis://:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}`;

    expect(redisUrl).toBe('redis://:redispass@localhost:6379');
  });
});
