export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton">
      {/* Dashboard Actions Skeleton */}
      <div className="dashboard-actions">
        <div className="dashboard-actions__search">
          <div className="h-10 w-80 bg-muted rounded animate-pulse" />
        </div>
        <div className="dashboard-actions__buttons">
          <div className="h-10 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Dashboard Tabs Skeleton */}
      <div className="dashboard-tabs mt-6">
        {/* Tab List Skeleton */}
        <div className="grid grid-cols-4 gap-1 mb-6">
          <div className="h-10 bg-muted rounded animate-pulse" />
          <div className="h-10 bg-muted rounded animate-pulse" />
          <div className="h-10 bg-muted rounded animate-pulse" />
          <div className="h-10 bg-muted rounded animate-pulse" />
        </div>

        {/* Stats Overview Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-card rounded-lg border p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                <div className="h-4 w-4 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-8 w-16 bg-muted rounded animate-pulse mb-1" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Recent Stacks Skeleton */}
        <div className="bg-card rounded-lg border">
          <div className="p-6">
            <div className="mb-4">
              <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-muted rounded animate-pulse" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="bg-muted/50 rounded-lg border p-4">
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                    </div>
                    <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                    <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}