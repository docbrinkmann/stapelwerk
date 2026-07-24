import { sanitizeProjectName } from './compose-executor'

/**
 * Deployed compose containers are named `<project>-<service>-1` where the
 * project is `bms-<stackId>` (see sanitizeProjectName). The stack terminal
 * uses these to exec into a specific service's container.
 */
export function stackContainerName(stackId: string, serviceSlug: string): string {
  return `${sanitizeProjectName(stackId)}-${serviceSlug}-1`
}

/**
 * True when a (client-supplied) container name belongs to the stack's compose
 * project. Security boundary for the terminal executor: combined with the
 * stack-ownership check it confines exec to the requesting user's own stack.
 */
export function containerBelongsToStack(container: string, stackId: string): boolean {
  return container.startsWith(`${sanitizeProjectName(stackId)}-`)
}
