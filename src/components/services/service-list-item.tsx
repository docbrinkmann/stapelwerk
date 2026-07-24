"use client"

import { MoreHorizontal, Plus, ExternalLink, FileText, Container } from "lucide-react"
import type { Service } from "@/types/service"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

/**
 * Service List Item Component
 * 
 * Compact row display for a service in the list view.
 * Shows icon, name, category, badges, and quick actions.
 */

interface ServiceListItemProps {
  service: Service
  onAddToStack?: (service: Service) => void
  onViewDetails?: (service: Service) => void
}

export function ServiceListItem({ 
  service, 
  onAddToStack, 
  onViewDetails 
}: ServiceListItemProps) {
  const getStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case "active":
        return "secondary"
      case "beta":
        return "outline"
      case "deprecated":
        return "destructive"
      default:
        return "secondary"
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50">
      {/* Service Icon */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Container className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Service Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{service.name}</h3>
          {service.featured && (
            <Badge variant="default" className="text-xs">
              Featured
            </Badge>
          )}
          {service.status && (
            <Badge variant={getStatusBadgeVariant(service.status)} className="text-xs">
              {service.status}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {service.description}
        </p>
      </div>

      {/* Category Badge */}
      <Badge variant="outline" className="hidden sm:flex">
        {service.category?.name || 'Uncategorized'}
      </Badge>

      {/* Docker Badge */}
      <div className="hidden md:flex gap-1">
        {service.dockerImage && (
          <Badge variant="secondary" className="text-xs">Docker</Badge>
        )}
        {service.version && (
          <Badge variant="outline" className="text-xs">v{service.version}</Badge>
        )}
      </div>

      {/* Quick Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => onAddToStack?.(service)}>
            <Plus className="mr-2 h-4 w-4" />
            Add to Stack
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onViewDetails?.(service)}>
            <FileText className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {service.documentationUrl && (
            <DropdownMenuItem asChild>
              <a href={service.documentationUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Documentation
              </a>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
