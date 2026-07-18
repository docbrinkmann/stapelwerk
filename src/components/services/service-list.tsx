"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import type { Service } from "@/types/service"
import { ServiceListItem } from "./service-list-item"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Service List Component
 * 
 * Container component that displays services in a list view.
 * Groups services by category with collapsible sections.
 * Includes search filtering.
 */

interface ServiceListProps {
  services: Service[]
  onAddToStack?: (service: Service) => void
  onServiceClick?: (service: Service) => void
  className?: string
}

export function ServiceList({ 
  services, 
  onAddToStack, 
  onServiceClick,
  className 
}: ServiceListProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Filter services by search query
  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services
    
    const query = searchQuery.toLowerCase()
    return services.filter(
      service =>
        service.name.toLowerCase().includes(query) ||
        service.description?.toLowerCase().includes(query) ||
        service.category?.name?.toLowerCase().includes(query) ||
        service.tags?.some(tag => tag.toLowerCase().includes(query))
    )
  }, [services, searchQuery])

  // Group services by category
  const groupedServices = useMemo(() => {
    const groups = new Map<string, Service[]>()
    
    filteredServices.forEach(service => {
      const categoryName = service.category?.name || "Uncategorized"
      if (!groups.has(categoryName)) {
        groups.set(categoryName, [])
      }
      groups.get(categoryName)!.push(service)
    })

    // Sort categories alphabetically
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredServices])

  // Initialize expanded categories (expand all by default)
  useMemo(() => {
    if (expandedCategories.size === 0 && groupedServices.length > 0) {
      setExpandedCategories(new Set(groupedServices.map(([category]) => category)))
    }
  }, [groupedServices])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedCategories(new Set(groupedServices.map(([category]) => category)))
  }

  const collapseAll = () => {
    setExpandedCategories(new Set())
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and Controls */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-sm text-muted-foreground">
        {filteredServices.length} services in {groupedServices.length} categories
      </p>

      {/* Empty State */}
      {filteredServices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No services found</h3>
          <p className="text-sm text-muted-foreground">
            Try adjusting your search query or filters
          </p>
        </div>
      )}

      {/* Grouped Service List */}
      <div className="space-y-2">
        {groupedServices.map(([category, categoryServices]) => (
          <Collapsible
            key={category}
            open={expandedCategories.has(category)}
            onOpenChange={() => toggleCategory(category)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between p-3 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium">{category}</span>
                  <span className="text-sm text-muted-foreground">
                    ({categoryServices.length})
                  </span>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pl-6">
              {categoryServices.map(service => (
                <ServiceListItem
                  key={service.id}
                  service={service}
                  onAddToStack={onAddToStack}
                  onViewDetails={onServiceClick}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  )
}
