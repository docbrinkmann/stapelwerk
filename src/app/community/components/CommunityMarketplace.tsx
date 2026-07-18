'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useStackBuilder } from '@/stores/stack-builder';
import { trpc } from '@/utils/trpc';
import {
  Search,
  Filter,
  Download,
  Upload,
  Share2,
  Heart,
  Eye,
  Star,
  Clock,
  Users,
  TrendingUp,
  Layers3,
  ArrowRight,
  ExternalLink,
  Copy,
  CheckCircle2,
  Grid,
  List,
  SlidersHorizontal
} from 'lucide-react';

interface CommunityStack {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  services: any[];
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  stats: {
    views: number;
    likes: number;
    downloads: number;
    rating: number;
    reviewCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
  featured?: boolean;
  dockerCompose?: string;
  documentation?: string;
}

interface MarketplaceStats {
  totalStacks: number;
  totalDownloads: number;
  activeContributors: number;
  featuredStacks: number;
}

/**
 * Map a raw community stack row (tRPC stacks row + stack_services) into the
 * card shape. Only real, tracked values: importCount is the one stat we
 * record; views/likes/rating are not tracked and stay 0 (the card hides them).
 */
const toCommunityStack = (row: any): CommunityStack => {
  const services = (row.stack_services ?? row.services ?? [])
    .map((ss: any) => ss?.services ?? ss)
    .filter(Boolean);
  const categoryNames = services
    .map((s: any) => s?.categories?.name)
    .filter(Boolean) as string[];
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: row.category ?? categoryNames[0] ?? 'general',
    difficulty: row.difficulty ?? 'beginner',
    tags: row.tags ?? [...new Set(categoryNames)],
    services,
    author: { id: row.userId ?? 'unknown', name: row.author?.name ?? '' },
    stats: {
      views: 0,
      likes: 0,
      downloads: row.importCount ?? 0,
      rating: 0,
      reviewCount: 0,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    featured: !!row.isTemplate,
    dockerCompose: row.dockerCompose,
  };
};

interface CommunityMarketplaceProps {
  initialFeatured: CommunityStack[];
  initialPopular: CommunityStack[];
  categories: string[];
  marketplaceStats: MarketplaceStats;
}

const CommunityMarketplace: React.FC<CommunityMarketplaceProps> = ({
  initialFeatured,
  initialPopular,
  categories,
  marketplaceStats
}) => {
  const router = useRouter();
  const { toast } = useToast();
  const { importFromJSON, exportAsJSON, services: currentServices } = useStackBuilder();
  const queryClient = useQueryClient();
  const trackImportMutation = trpc.community.trackImport.useMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'rating'>('popular');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStack, setSelectedStack] = useState<CommunityStack | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  // Server passes raw tRPC rows — normalize once at the boundary.
  const [featuredStacks] = useState(() => (initialFeatured ?? []).map(toCommunityStack));
  const [popularStacks] = useState(() => (initialPopular ?? []).map(toCommunityStack));
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Search stacks query
  const searchStacksQuery = trpc.community.searchStacks.useQuery({
    query: searchQuery,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    difficulty: selectedDifficulty !== 'all' ? selectedDifficulty as any : undefined,
    sortBy,
    limit: 24
  }, {
    enabled: searchQuery.length > 0,
  });

  // Online/offline detection
  useEffect(() => {
    const updateStatus = () => setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const handleQuickImport = async (stack: CommunityStack) => {
    if (currentServices.length > 0) {
      setSelectedStack(stack);
      setShowImportDialog(true);
      return;
    }

    await handleImportStack(stack);
  };

  const handleImportStack = async (stack: CommunityStack) => {
    setIsImporting(true);
    try {
      const stackData = {
        name: `${stack.name} (imported)`,
        description: stack.description,
        services: stack.services
      };

      await importFromJSON(JSON.stringify(stackData));
      
      toast({
        title: 'Stack Imported Successfully!',
        description: 'The community stack has been imported to your workspace.',
variant: 'default'
      });

      // Track import analytics
      trackImportMutation.mutate({ stackId: stack.id });

      router.push('/stack-builder');
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: 'Failed to import stack. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
      setShowImportDialog(false);
    }
  };

  const handleExportToFile = (stack: CommunityStack) => {
    if (!stack.dockerCompose) {
      toast({
        title: 'Export Not Available',
        description: 'Docker Compose file is not available for this stack.',
        variant: 'destructive'
      });
      return;
    }

    const blob = new Blob([stack.dockerCompose], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stack.name.toLowerCase().replace(/\s+/g, '-')}-docker-compose.yml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download Started',
      description: 'Docker Compose file is downloading.',
      variant: 'default'
    });
  };

  const handleShareStack = async (stack: CommunityStack) => {
    try {
      const shareUrl = `${window.location.origin}/shared/${stack.id}`;
      await navigator.clipboard.writeText(shareUrl);
      
      toast({
        title: 'Share URL Copied!',
        description: 'Stack share link copied to clipboard.',
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Failed to copy share URL.',
        variant: 'destructive'
      });
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-success/10 text-success border-success/30';
      case 'intermediate': return 'bg-warning/10 text-warning border-warning/30';
      case 'advanced': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < Math.floor(rating)
                ? 'text-warning fill-current'
                : 'text-muted-foreground/40'
            }`}
          />
        ))}
        <span className="text-xs text-muted-foreground ml-1">({rating.toFixed(1)})</span>
      </div>
    );
  };

  const renderStackCard = (stack: CommunityStack, featured = false) => (
    <Card 
      key={stack.id}
      className={`group hover:shadow-lg transition-all duration-200 cursor-pointer ${
        featured ? 'ring-2 ring-primary/30 shadow-md' : ''
      }`}
      onClick={() => router.push(`/shared/${stack.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base group-hover:text-primary transition-colors">
                {stack.name}
              </CardTitle>
              {stack.featured && (
                <Badge variant="default" className="text-xs px-2 py-0.5">
                  <Star className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              )}
            </div>
            <CardDescription className="text-sm line-clamp-2">
              {stack.description}
            </CardDescription>
          </div>
          <Badge className={getDifficultyColor(stack.difficulty)}>
            {stack.difficulty}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats — only metrics we actually track (imports). */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1" title="Times imported">
            <Download className="h-3 w-3" />
            {(stack.stats?.downloads ?? 0).toLocaleString()} imports
          </span>
          <div className="flex items-center gap-1">
            <Layers3 className="h-3 w-3" />
            <span>{stack.services.length} services</span>
          </div>
        </div>

        {/* Rating */}
        {(stack.stats?.rating ?? 0) > 0 && (
          <div className="flex items-center justify-between">
            {renderStarRating(stack.stats.rating)}
            <span className="text-xs text-muted-foreground">
              {stack.stats.reviewCount} reviews
            </span>
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {stack.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {stack.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{stack.tags.length - 3}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              handleQuickImport(stack);
            }}
          >
            <Upload className="h-3 w-3 mr-1" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleExportToFile(stack);
            }}
          >
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleShareStack(stack);
            }}
          >
            <Share2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const stacks = searchQuery
    ? (searchStacksQuery.data?.stacks || []).map(toCommunityStack)
    : popularStacks;
  const filteredStacks = stacks.filter((stack) => {
    const categoryMatch = selectedCategory === 'all' || stack.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === 'all' || stack.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

  return (
    <div className="min-h-screen">
      {/* Offline banner */}
      {!isOnline && (
        <div role="status" aria-live="polite" className="offline-banner">
          <div className="offline-banner__content">
            <span>You’re offline. Check your connection and retry.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries()}
              className="ml-3"
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      {/* Hero Section */}
      <div className="border-b bg-card py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-foreground">Community Stack Marketplace</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover, share, and import infrastructure stacks created by developers worldwide.
              Find the perfect configuration for your next project.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{marketplaceStats.totalStacks.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Community Stacks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{marketplaceStats.totalDownloads.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Downloads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{marketplaceStats.activeContributors.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Contributors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{marketplaceStats.featuredStacks.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Featured Stacks</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Featured Stacks */}
        {featuredStacks.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Featured Stacks</h2>
              <Button variant="outline" onClick={() => router.push('/community')}>
                View All <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredStacks.map((stack) => renderStackCard(stack, true))}
            </div>
          </section>
        )}

        {/* Search and Filters */}
        <div className="bg-card rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search community stacks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <Label className="text-sm font-medium mb-2 block">Category</Label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Difficulty</Label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="all">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Sort By</Label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="popular">Most Popular</option>
                  <option value="recent">Most Recent</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stack Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              {searchQuery ? `Search Results (${filteredStacks.length})` : 'Popular Stacks'}
            </h2>
          </div>

          {searchQuery && searchStacksQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-label="Loading search results">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : searchStacksQuery.isError ? (
            <div className="text-center py-12" role="alert" aria-live="polite">
              <Layers3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium text-foreground mb-2">Failed to load stacks</h3>
              <p className="text-muted-foreground mb-4">
                {(searchStacksQuery.error as any)?.message || 'Something went wrong. Please try again.'}
              </p>
              <Button onClick={() => searchStacksQuery.refetch()}>Try again</Button>
            </div>
          ) : filteredStacks.length === 0 ? (
            <div className="text-center py-12">
              <Layers3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium text-foreground mb-2">No stacks found</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery 
                  ? `No stacks match your search for "${searchQuery}"`
                  : 'Try adjusting your filters or search terms'
                }
              </p>
              <Button onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedDifficulty('all');
              }}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className={`grid gap-6 ${
              viewMode === 'grid'
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1'
            }`}>
              {filteredStacks.map((stack: any) => renderStackCard(stack as CommunityStack))}
            </div>
          )}
        </section>
      </div>

      {/* Import Confirmation Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Community Stack</DialogTitle>
            <DialogDescription>
              This will import "{selectedStack?.name}" into your workspace.
              Your current stack will be replaced.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-info/10 border border-info/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">What will be imported:</h4>
              <ul className="text-sm text-foreground space-y-1">
                <li>• {selectedStack?.services.length} services</li>
                <li>• Service configurations and settings</li>
                <li>• Stack metadata and description</li>
              </ul>
            </div>
            
            {currentServices.length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <p className="text-sm text-warning">
                  You have {currentServices.length} services in your current workspace.
                  Importing will replace your current stack.
                </p>
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowImportDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => selectedStack && handleImportStack(selectedStack)}
                disabled={isImporting}
              >
                {isImporting ? 'Importing...' : 'Import Stack'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunityMarketplace;