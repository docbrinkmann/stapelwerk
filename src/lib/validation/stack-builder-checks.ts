import type { StackService } from '@/types/stack'
import { StackServiceConfigValidator } from './stack-config-validator'
import { areIncompatible } from '@/lib/recommendations/compatibility-matrix'

/**
 * Live builder checks
 *
 * Runs the real, stack-wide validation against the current builder store as the
 * user composes — the guidance Coolify/Dokploy don't surface until deploy time.
 * It reuses the server-side `StackServiceConfigValidator` (a pure static class,
 * safe to call client-side) for host-port and volume-mount conflict detection,
 * and layers on missing-dependency-target and soft compatibility advisories.
 */

export type BuilderCheckSeverity = 'error' | 'warning'
export type BuilderCheckKind = 'port' | 'volume' | 'dependency' | 'compatibility'

export interface BuilderCheck {
  id: string
  kind: BuilderCheckKind
  severity: BuilderCheckSeverity
  title: string
  message: string
}

/**
 * Adapt the builder store's array-shaped configuration into the record shape
 * `StackServiceConfigValidator.validateStackConfiguration` expects.
 */
function toValidatorInput(services: StackService[]) {
  return services.map(({ service, configuration }) => ({
    serviceName: service?.name ?? '',
    configuration: {
      // Configs can arrive thin (loaded from the dashboard list) — guard the
      // arrays so analyzeStack() can't throw "undefined.map" and blank the builder.
      portMappings: Object.fromEntries(
        (Array.isArray(configuration?.portMappings) ? configuration.portMappings : [])
          .map(p => [String(p.containerPort), String(p.hostPort)])
      ),
      volumeMounts: Object.fromEntries(
        (Array.isArray(configuration?.volumeMounts) ? configuration.volumeMounts : [])
          .map(v => [v.containerPath, v.hostPath])
      ),
    },
  }))
}

/**
 * Analyze the whole stack and return the problems worth surfacing in the
 * builder. Pure and synchronous so it can run on every store change.
 */
export function analyzeStack(services: StackService[]): BuilderCheck[] {
  const checks: BuilderCheck[] = []

  if (services.length === 0) return checks

  // 1 + 2: host-port and volume-mount conflicts (reused validator).
  const result = StackServiceConfigValidator.validateStackConfiguration(
    toValidatorInput(services)
  )
  for (const err of [...result.errors, ...result.warnings]) {
    const kind: BuilderCheckKind =
      err.field.includes('volume') ? 'volume' : 'port'
    checks.push({
      id: `${kind}-${err.field}-${err.message}`,
      kind,
      severity: err.severity === 'error' ? 'error' : 'warning',
      title: kind === 'port' ? 'Port conflict' : 'Shared volume',
      message: err.message,
    })
  }

  // 3: dependency targets that aren't in the stack.
  const serviceIds = new Set(services.map(s => s.serviceId))
  for (const s of services) {
    // Imported/legacy drafts can carry a thin config without dependsOn.
    for (const dep of s.configuration?.dependsOn ?? []) {
      if (!serviceIds.has(dep.serviceId)) {
        checks.push({
          id: `dependency-${s.serviceId}-${dep.serviceId}`,
          kind: 'dependency',
          severity: 'warning',
          title: 'Missing dependency',
          message: `${s.service.name} depends on a service that isn't in this stack — add it or remove the dependency.`,
        })
      }
    }
  }

  // 4: soft compatibility advisories (e.g. two reverse proxies both wanting :80).
  for (let i = 0; i < services.length; i++) {
    for (let j = i + 1; j < services.length; j++) {
      const a = services[i].service
      const b = services[j].service
      if (areIncompatible(a.slug, b.slug)) {
        checks.push({
          id: `compatibility-${a.slug}-${b.slug}`,
          kind: 'compatibility',
          severity: 'warning',
          title: 'May conflict',
          message: `${a.name} and ${b.name} may conflict — they typically compete for the same host port. Run one, or remap the other.`,
        })
      }
    }
  }

  return checks
}
