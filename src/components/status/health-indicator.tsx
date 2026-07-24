'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { 
  Activity,
  Heart,
  HeartOff,
  HeartPulse,
  AlertCircle,
  Loader2
} from 'lucide-react'

export type HealthStatus = 
  | 'healthy' 
  | 'unhealthy' 
  | 'degraded' 
  | 'unknown'
  | 'checking'

interface HealthIndicatorProps {
  status: HealthStatus
  showLabel?: boolean
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'badge' | 'dot' | 'icon'
  className?: string
}

const healthConfig: Record<HealthStatus, {
  label: string
  icon: typeof Activity
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  iconColor: string
  dotColor: string
  bgColor: string
}> = {
  healthy: {
    label: 'Healthy',
    icon: Heart,
    badgeVariant: 'default',
    iconColor: 'text-success',
    dotColor: 'bg-success',
    bgColor: 'bg-success/10',
  },
  unhealthy: {
    label: 'Unhealthy',
    icon: HeartOff,
    badgeVariant: 'destructive',
    iconColor: 'text-destructive',
    dotColor: 'bg-destructive',
    bgColor: 'bg-destructive/10',
  },
  degraded: {
    label: 'Degraded',
    icon: HeartPulse,
    badgeVariant: 'secondary',
    iconColor: 'text-warning',
    dotColor: 'bg-warning',
    bgColor: 'bg-warning/10',
  },
  unknown: {
    label: 'Unknown',
    icon: AlertCircle,
    badgeVariant: 'outline',
    iconColor: 'text-muted-foreground',
    dotColor: 'bg-muted-foreground',
    bgColor: 'bg-muted',
  },
  checking: {
    label: 'Checking',
    icon: Loader2,
    badgeVariant: 'outline',
    iconColor: 'text-info',
    dotColor: 'bg-info',
    bgColor: 'bg-info/10',
  },
}

const sizeConfig = {
  sm: {
    icon: 'h-3 w-3',
    dot: 'h-1.5 w-1.5',
    text: 'text-xs',
    container: 'h-6 w-6',
  },
  md: {
    icon: 'h-4 w-4',
    dot: 'h-2 w-2',
    text: 'text-sm',
    container: 'h-8 w-8',
  },
  lg: {
    icon: 'h-5 w-5',
    dot: 'h-2.5 w-2.5',
    text: 'text-base',
    container: 'h-10 w-10',
  },
}

export function HealthIndicator({ 
  status, 
  showLabel = true,
  showIcon = true,
  size = 'md',
  variant = 'badge',
  className 
}: HealthIndicatorProps) {
  const config = healthConfig[status] || healthConfig.unknown
  const sizes = sizeConfig[size]
  const Icon = config.icon
  const isAnimated = status === 'checking'

  if (variant === 'dot') {
    return (
      <span 
        className={cn('inline-flex items-center gap-1.5', className)}
        role="status"
        aria-label={`Health status: ${config.label}`}
      >
        <span
          className={cn(
            'rounded-full',
            sizes.dot,
            config.dotColor,
            isAnimated && 'animate-pulse'
          )}
          aria-hidden="true"
        />
        {showLabel && (
          <span className={cn(sizes.text, 'text-muted-foreground')}>
            {config.label}
          </span>
        )}
      </span>
    )
  }

  if (variant === 'icon') {
    return (
      <div 
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          sizes.container,
          config.bgColor,
          className
        )}
        role="status"
        aria-label={`Health status: ${config.label}`}
      >
        <Icon 
          className={cn(
            sizes.icon, 
            config.iconColor,
            isAnimated && 'animate-spin'
          )}
          aria-hidden="true"
        />
      </div>
    )
  }

  // Default badge variant
  return (
    <Badge 
      variant={config.badgeVariant}
      className={cn('gap-1.5', className)}
      role="status"
      aria-label={`Health status: ${config.label}`}
    >
      {showIcon && (
        <Icon 
          className={cn(
            sizes.icon, 
            config.iconColor,
            isAnimated && 'animate-spin'
          )}
          aria-hidden="true"
        />
      )}
      {showLabel && (
        <span className={sizes.text}>{config.label}</span>
      )}
    </Badge>
  )
}

// Service health card component
interface ServiceHealthProps {
  name: string
  status: HealthStatus
  lastCheck?: Date
  responseTime?: number // in ms
  className?: string
}

export function ServiceHealth({ 
  name, 
  status, 
  lastCheck,
  responseTime,
  className 
}: ServiceHealthProps) {
  const config = healthConfig[status] || healthConfig.unknown

  return (
    <div 
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <HealthIndicator status={status} variant="icon" size="sm" />
        <div>
          <p className="font-medium">{name}</p>
          {lastCheck && (
            <p className="text-xs text-muted-foreground">
              Last check: {lastCheck.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
      <div className="text-right">
        <HealthIndicator status={status} showIcon={false} size="sm" />
        {responseTime !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            {responseTime}ms
          </p>
        )}
      </div>
    </div>
  )
}

// Export utility for getting health color classes
export function getHealthColorClasses(status: HealthStatus) {
  return healthConfig[status] || healthConfig.unknown
}
