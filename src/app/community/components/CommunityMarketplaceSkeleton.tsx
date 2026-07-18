export default function CommunityMarketplaceSkeleton() {
  return (
    <div className="min-h-screen">
      {/* Hero Skeleton */}
      <div className="bg-gradient-to-r from-muted-foreground/30 to-muted-foreground/40 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center animate-pulse">
            <div className="h-10 bg-background/20 rounded w-96 mx-auto mb-4"></div>
            <div className="h-6 bg-background/20 rounded w-[32rem] mx-auto mb-8"></div>
            
            {/* Stats Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-8 bg-background/20 rounded w-16 mx-auto mb-2"></div>
                  <div className="h-4 bg-background/20 rounded w-20 mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Featured Section Skeleton */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 bg-muted rounded w-48 animate-pulse"></div>
            <div className="h-10 bg-muted rounded w-24 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg shadow-sm border p-6 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="h-5 bg-muted rounded w-40 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-full mb-1"></div>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </div>
                  <div className="h-6 bg-muted rounded w-20"></div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="h-4 bg-muted rounded w-12"></div>
                      <div className="h-4 bg-muted rounded w-12"></div>
                      <div className="h-4 bg-muted rounded w-12"></div>
                    </div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="h-5 bg-muted rounded w-16"></div>
                    <div className="h-5 bg-muted rounded w-16"></div>
                    <div className="h-5 bg-muted rounded w-16"></div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <div className="h-8 bg-muted rounded flex-1"></div>
                    <div className="h-8 bg-muted rounded w-20"></div>
                    <div className="h-8 bg-muted rounded w-12"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search and Filters Skeleton */}
        <div className="bg-card rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 h-10 bg-muted rounded animate-pulse"></div>
            <div className="h-10 bg-muted rounded w-20 animate-pulse"></div>
            <div className="flex gap-2">
              <div className="h-8 bg-muted rounded w-8 animate-pulse"></div>
              <div className="h-8 bg-muted rounded w-8 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Popular Stacks Skeleton */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="h-7 bg-muted rounded w-40 animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-card rounded-lg shadow-sm border p-6 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="h-5 bg-muted rounded w-32 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-full mb-1"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                  </div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3">
                      <div className="h-4 bg-muted rounded w-10"></div>
                      <div className="h-4 bg-muted rounded w-10"></div>
                      <div className="h-4 bg-muted rounded w-10"></div>
                    </div>
                    <div className="h-4 bg-muted rounded w-14"></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, j) => (
                        <div key={j} className="h-3 w-3 bg-muted rounded"></div>
                      ))}
                    </div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="h-5 bg-muted rounded w-14"></div>
                    <div className="h-5 bg-muted rounded w-14"></div>
                    <div className="h-5 bg-muted rounded w-8"></div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <div className="h-8 bg-muted rounded flex-1"></div>
                    <div className="h-8 bg-muted rounded w-18"></div>
                    <div className="h-8 bg-muted rounded w-10"></div>
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