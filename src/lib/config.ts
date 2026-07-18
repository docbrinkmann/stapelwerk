import fs from 'fs';
import path from 'path';

/**
 * Docker Secrets Configuration Module
 * 
 * Reads secrets from Docker Swarm secrets mounted at /run/secrets/
 * Falls back to environment variables for development environments
 */

const SECRETS_PATH = '/run/secrets';

/**
 * Get a secret value from Docker secrets or environment variables
 * 
 * NOTE: Computes NODE_ENV dynamically on each call so tests and runtime
 * changes to process.env are respected without needing to re-import.
 * 
 * @param secretName - Name of the secret to retrieve
 * @param envVarName - Optional environment variable name (defaults to secretName)
 * @returns The secret value as a string
 * @throws Error if secret is not found in production
 */
export function getSecret(secretName: string, envVarName?: string): string {
  const envVar = envVarName || secretName;
  const isDevelopment = (process.env.NODE_ENV || 'development') !== 'production';
  
  // Try to read from Docker secrets first (production)
  if (!isDevelopment) {
    try {
      const secretPath = path.join(SECRETS_PATH, secretName);
      if (fs.existsSync(secretPath)) {
        const secret = fs.readFileSync(secretPath, 'utf8').trim();
        if (secret) {
          return secret;
        }
      }
    } catch (error) {
      console.warn(`Failed to read secret ${secretName} from ${SECRETS_PATH}:`, error);
    }
  }
  
  // Fallback to environment variable
  const envValue = process.env[envVar];
  if (envValue) {
    return envValue;
  }
  
  // In production, throw error if secret not found
  if (!isDevelopment) {
    throw new Error(
      `Secret '${secretName}' not found. Please ensure Docker secret is created or ${envVar} environment variable is set.`
    );
  }
  
  // In development, return empty string with warning
  console.warn(
    `Warning: Secret '${secretName}' not found. Using empty string. Set ${envVar} environment variable or create secret file.`
  );
  return '';
}

/**
 * Database Configuration
 * 
 * Use getters so values always reflect current environment variables.
 */
export const dbConfig = {
  get host() { return process.env.DB_HOST || 'localhost'; },
  get port() { return parseInt(process.env.DB_PORT || '5432', 10); },
  get database() { return process.env.DB_NAME || 'buildmystack'; },
  get user() { return process.env.DB_USER || 'buildmystack_user'; },
  get password() { return getSecret('db_password', 'DB_PASSWORD'); },
} as const;

/**
 * Redis Configuration
 * 
 * Use getters so values always reflect current environment variables.
 */
export const redisConfig = {
  get host() { return process.env.REDIS_HOST || 'localhost'; },
  get port() { return parseInt(process.env.REDIS_PORT || '6379', 10); },
  get password() { return getSecret('redis_password', 'REDIS_PASSWORD'); },
} as const;

/**
 * JWT Configuration
 * 
 * Use getters so values always reflect current environment variables.
 */
export const jwtConfig = {
  get secret() { return getSecret('jwt_secret', 'JWT_SECRET'); },
  get expiresIn() { return process.env.JWT_EXPIRES_IN || '7d'; },
} as const;

/**
 * Application Configuration
 * 
 * Use getters so values always reflect current environment variables.
 */
export const appConfig = {
  get nodeEnv() { return process.env.NODE_ENV || 'development'; },
  get port() { return parseInt(process.env.PORT || '8080', 10); },
  get logLevel() { return process.env.LOG_LEVEL || 'info'; },
  get logFormat() { return process.env.LOG_FORMAT || 'json'; },
} as const;

/**
 * Secret Rotation Procedure
 * 
 * To rotate secrets in production:
 * 
 * 1. Generate new secret:
 *    openssl rand -base64 32 > secrets/db_password_new.txt
 * 
 * 2. Create new Docker secret:
 *    docker secret create db_password_v2 secrets/db_password_new.txt
 * 
 * 3. Update service to use new secret:
 *    docker service update --secret-rm db_password --secret-add source=db_password_v2,target=db_password buildmystack-ai
 * 
 * 4. Remove old secret after verification:
 *    docker secret rm db_password_v1
 * 
 * 5. Update database/Redis/JWT with new credentials as needed
 */
