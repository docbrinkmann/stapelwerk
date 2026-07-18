'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCw,
  AlertTriangle,
  Pause,
  HelpCircle
} from 'lucide-react'

export type DeploymentStatus = 
  | 'success' 
  | 'failed' 
  | 'running' 
  | 'pending' 
  | 'cancelled'
  | 'paused'
  | 'unknown'

interface DeploymentStatusProps {
  status: DeploymentStatus
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig: Record<DeploymentStatus, {
  label: string
  icon: typeof CheckCircle2
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  iconColor: string
  dotColor: string
}> = {
  success: {
    label: 'Success',
    icon: CheckCircle2,
    variant: 'default',
    iconColor: 'text-success',
    dotColor: 'bg-success',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive',
    iconColor: 'text-destructive',
    dotColor: 'bg-destructive',
  },
  running: {
    label: 'Running',
    icon: RotateCw,
    variant: 'secondary',
    iconColor: 'text-info',
    dotColor: 'bg-info',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    variant: 'outline',
    iconColor: 'text-warning',
    dotColor: 'bg-warning',
  },
  cancelled: {
    label: 'Cancelled',
    icon: AlertTriangle,
    variant: 'outline',
    iconColor: 'text-muted-foreground',
    dotColor: 'bg-muted-foreground',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    variant: 'outline',
    iconColor: 'text-warning',
    dotColor: 'bg-warning',
  },
  unknown: {
    label: 'Unknown',
    icon: HelpCircle,
    variant: 'outline',
    iconColor: 'text-muted-foreground',
    dotColor: 'bg-muted-foreground',
  },
}

const sizeConfig = {
  sm: {
    icon: 'h-3 w-3',
    dot: 'h-1.5 w-1.5',
    text: 'text-xs',
  },
  md: {
    icon: 'h-4 w-4',
    dot: 'h-2 w-2',
    text: 'text-sm',
  },
  lg: {
    icon: 'h-5 w-5',
    dot: 'h-2.5 w-2.5',
    text: 'text-base',
  },
}

export function DeploymentStatus({ 
  status, 
  showLabel = true,
  size = 'md',
  className 
}: DeploymentStatusProps) {
  const config = statusConfig[status] || statusConfig.unknown
  const sizes = sizeConfig[size]
  const Icon = config.icon
  const isAnimated = status === 'running'

  return (
    <Badge 
      variant={config.variant}
      className={cn('gap-1.5', className)}
      role="status"
      aria-label={`Deployment status: ${config.label}`}
    >
      <Icon 
        className={cn(
          sizes.icon, 
          config.iconColor,
          isAnimated && 'animate-spin'
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span className={sizes.text}>{config.label}</span>
      )}
    </Badge>
  )
}

// Simple dot-only status indicator
export function StatusDot({ 
  status, 
  size = 'md',
  pulse = false,
  className 
}: { 
  status: DeploymentStatus
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  className?: string 
}) {
  const config = statusConfig[status] || statusConfig.unknown
  const sizes = sizeConfig[size]

  return (
    <span 
      className={cn('relative inline-flex', className)}
      role="status"
      aria-label={`Deployment status: ${config.label}`}
    >
      <span
        className={cn(
          'rounded-full',
          sizes.dot,
          config.dotColor,
          pulse && 'animate-pulse'
        )}
        aria-hidden="true"
      />
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex rounded-full opacity-75 animate-ping',
            sizes.dot,
            config.dotColor
          )}
          aria-hidden="true"
        />
      )}
    </span>
  )
}
