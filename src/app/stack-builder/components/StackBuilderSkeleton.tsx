export function StackBuilderSkeleton() {
  return (
    <div className="stack-builder-skeleton">
      {/* Toolbar Skeleton */}
      <div className="stack-builder__toolbar">
        <div className="stack-builder__toolbar-left">
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-muted rounded animate-pulse" />
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            <div className="h-8 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
        
        <div className="stack-builder__toolbar-right">
          <div className="flex items-center gap-3">
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            <div className="h-8 w-px bg-muted" />
            <div className="flex gap-1">
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout Skeleton */}
      <div className="stack-builder__layout">
        {/* Left Panel Skeleton */}
        <div className="stack-builder__services-panel expanded">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            </div>
            <div className="flex gap-1">
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
              <div className="h-8 w-8 bg-muted rounded animate-pulse" />
            </div>
          </div>
          
          <div className="panel-content">
            {/* Search Skeleton */}
            <div className="search-section">
              <div className="h-10 w-full bg-muted rounded animate-pulse" />
            </div>

            {/* Filter Skeleton */}
            <div className="filter-section">
              <div className="space-y-3">
                <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Services Grid Skeleton */}
            <div className="services-section">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="service-card-skeleton">
                    <div className="h-48 bg-muted rounded animate-pulse">
                      <div className="p-4">
                        <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-2" />
                        <div className="h-3 w-full bg-muted rounded animate-pulse mb-1" />
                        <div className="h-3 w-2/3 bg-muted rounded animate-pulse mb-3" />
                        <div className="flex gap-2 mb-3">
                          <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                          <div className="h-5 w-12 bg-muted rounded-full animate-pulse" />
                        </div>
                        <div className="h-8 w-full bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel Skeleton */}
        <div className="stack-builder__canvas-panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              <div className="h-5 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-8 w-8 bg-muted rounded animate-pulse" />
          </div>
          
          <div className="panel-content">
            <div className="stack-canvas-skeleton">
              <div className="h-full min-h-96 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="h-6 w-48 bg-muted rounded animate-pulse mb-2 mx-auto" />
                  <div className="h-4 w-64 bg-muted rounded animate-pulse mx-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}