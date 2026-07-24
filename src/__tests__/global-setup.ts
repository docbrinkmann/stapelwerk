import { spawnSync } from 'node:child_process'

export default async function () {
  const dbUrl = process.env.DATABASE_TEST_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres_dev_password@localhost:5432/build_my_stack_test?schema=public'
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = dbUrl
  }
  if (!process.env.DATABASE_TEST_URL) {
    process.env.DATABASE_TEST_URL = dbUrl
  }

  // Run prisma generate (idempotent)
  const gen = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'generate'], {
    stdio: 'inherit',
    env: process.env as NodeJS.ProcessEnv,
  })
  if (gen.status !== 0) {
    throw new Error('[global-setup] prisma generate failed')
  }

  // Push schema to test DB (idempotent)
  const shouldEnforceDbPush = process.env.CI === 'true' || process.env.FORCE_DB_SETUP === 'true'
  const push = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'db', 'push', '--skip-generate'], {
    stdio: 'inherit',
    env: process.env as NodeJS.ProcessEnv,
  })
  if (push.status !== 0) {
    if (shouldEnforceDbPush) {
      throw new Error('[global-setup] prisma db push failed')
    } else {
      // Allow local/unit runs without a running Postgres instance
      console.warn('[global-setup] prisma db push failed — continuing (non-CI)')
    }
  }
}
