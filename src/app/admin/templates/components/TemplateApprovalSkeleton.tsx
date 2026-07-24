export default function TemplateApprovalSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Overview Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-4 w-4 bg-muted rounded"></div>
            </div>
            <div className="h-8 bg-muted rounded w-12 mb-2"></div>
            <div className="h-3 bg-muted rounded w-32"></div>
          </div>
        ))}
      </div>

      {/* Template Queue Skeleton */}
      <div className="bg-card rounded-lg border">
        <div className="p-6 border-b">
          <div className="h-6 bg-muted rounded w-32 mb-2"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
        </div>
        
        <div className="p-6">
          {/* Search and Filter Skeleton */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-10 bg-muted rounded"></div>
            <div className="w-32 h-10 bg-muted rounded"></div>
          </div>

          {/* Template Cards Skeleton */}
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-6 bg-muted rounded w-48"></div>
                      <div className="h-5 bg-muted rounded w-16"></div>
                      <div className="h-5 bg-muted rounded w-20"></div>
                    </div>
                    <div className="h-4 bg-muted rounded w-full mb-3"></div>
                    <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                    
                    <div className="flex items-center gap-6 mb-4">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="h-4 bg-muted rounded w-20"></div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      {[...Array(3)].map((_, j) => (
                        <div key={j} className="h-5 bg-muted rounded w-16"></div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <div className="h-8 bg-muted rounded w-20"></div>
                    <div className="h-8 bg-muted rounded w-20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}