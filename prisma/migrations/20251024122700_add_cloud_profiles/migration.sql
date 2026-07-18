-- Prisma Migration: add cloud_profiles table (optional persistence)
-- NOTE: This is a hand-written migration for reference; adjust as needed when running `prisma migrate`.

-- CreateTable
CREATE TABLE IF NOT EXISTS "cloud_profiles" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "cloud" TEXT NOT NULL,
  "presetsVersion" TEXT NOT NULL DEFAULT 'v1',
  "lastUsedParams" TEXT NOT NULL DEFAULT '{}',
  "userId" TEXT,
  "organizationId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "cloud_profiles_cloud_idx" ON "cloud_profiles" ("cloud");
CREATE INDEX IF NOT EXISTS "cloud_profiles_user_idx" ON "cloud_profiles" ("userId");
CREATE INDEX IF NOT EXISTS "cloud_profiles_org_idx" ON "cloud_profiles" ("organizationId");
