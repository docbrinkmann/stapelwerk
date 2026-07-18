import { createTRPCRouter } from './trpc'
import { adminRouter } from './routers/admin'
import { analyticsRouter } from './routers/analytics'
import { categoriesRouter } from './routers/categories'
import { communityRouter } from './routers/community'
import { healthRouter } from './routers/health'
import { importsRouter } from './routers/imports'
import { monitoringRouter } from './routers/monitoring'
import { recommendationsRouter } from './routers/recommendations'
import { servicesRouter } from './routers/services'
import { stacksRouter } from './routers/stacks'
import { templatesRouter } from './routers/templates'
import { deploymentsRouter } from './routers/deployments'
import { logsRouter } from './routers/logs'
import { terminalRouter } from './routers/terminal'
import { usersRouter } from './routers/users'

/**
 * Main tRPC router
 *
 * This is the primary router for the application.
 * All routers added here are available to the client.
 */
export const appRouter = createTRPCRouter({
  admin: adminRouter,
  analytics: analyticsRouter,
  categories: categoriesRouter,
  community: communityRouter,
  health: healthRouter,
  imports: importsRouter,
  monitoring: monitoringRouter,
  recommendations: recommendationsRouter,
  services: servicesRouter,
  stacks: stacksRouter,
  templates: templatesRouter,
  deployments: deploymentsRouter,
  logs: logsRouter,
  terminal: terminalRouter,
  users: usersRouter,
})

// Export type definition of the router
export type AppRouter = typeof appRouter
