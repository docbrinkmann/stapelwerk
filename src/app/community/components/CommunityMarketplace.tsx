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
import { useT } from '@/lib/i18n/client';
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
  const t = useT();
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
        title: t('catalog.toastStackImportedTitle'),
        description: t('catalog.toastCommunityImportedDesc'),
variant: 'default'
      });

      // Track import analytics
      trackImportMutation.mutate({ stackId: stack.id });

      router.push('/stack-builder');
    } catch (error) {
      toast({
        title: t('catalog.toastImportFailedTitle'),
        description: t('catalog.toastImportFailedDesc'),
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
        title: t('catalog.toastExportNotAvailableTitle'),
        description: t('catalog.composeNotAvailable'),
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
      title: t('catalog.toastDownloadStartedTitle'),
      description: t('catalog.toastDownloadStartedDesc'),
      variant: 'default'
    });
  };

  const handleShareStack = async (stack: CommunityStack) => {
    try {
      const shareUrl = `${window.location.origin}/shared/${stack.id}`;
      await navigator.clipboard.writeText(shareUrl);
      
      toast({
        title: t('catalog.toastShareUrlCopiedTitle'),
        description: t('catalog.toastShareUrlCopiedDesc'),
        variant: 'default'
      });
    } catch (error) {
      toast({
        title: t('catalog.copyFailedTitle'),
        description: t('catalog.toastCopyShareUrlFailedDesc'),
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
                  {t('catalog.featuredBadge')}
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
          <span className="flex items-center gap-1" title={t('catalog.timesImportedTitle')}>
            <Download className="h-3 w-3" />
            {t('catalog.importsCount', { count: (stack.stats?.downloads ?? 0).toLocaleString() })}
          </span>
          <div className="flex items-center gap-1">
            <Layers3 className="h-3 w-3" />
            <span>{t('catalog.servicesCount', { count: stack.services.length })}</span>
          </div>
        </div>

        {/* Rating */}
        {(stack.stats?.rating ?? 0) > 0 && (
          <div className="flex items-center justify-between">
            {renderStarRating(stack.stats.rating)}
            <span className="text-xs text-muted-foreground">
              {t('catalog.reviewsCount', { count: stack.stats.reviewCount })}
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
            {t('common.import')}
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
            {t('common.export')}
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
            <span>{t('catalog.offlineBanner')}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries()}
              className="ml-3"
            >
              {t('common.retry')}
            </Button>
          </div>
        </div>
      )}
      {/* Hero Section */}
      <div className="border-b bg-card py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-foreground">{t('catalog.communityTitle')}</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('catalog.communitySubtitle')}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{marketplaceStats.totalStacks.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">{t('catalog.statCommunityStacks')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{marketplaceStats.totalDownloads.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">{t('catalog.statTotalDownloads')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{marketplaceStats.activeContributors.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">{t('catalog.statContributors')}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{marketplaceStats.featuredStacks.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">{t('catalog.featuredStacks')}</div>
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
              <h2 className="text-2xl font-bold text-foreground">{t('catalog.featuredStacks')}</h2>
              <Button variant="outline" onClick={() => router.push('/community')}>
                {t('catalog.viewAll')} <ArrowRight className="h-4 w-4 ml-2" />
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
                  placeholder={t('catalog.searchCommunityPlaceholder')}
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
              {t('catalog.filters')}
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
                <Label className="text-sm font-medium mb-2 block">{t('catalog.categoryLabel')}</Label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="all">{t('catalog.allCategories')}</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">{t('catalog.difficultyLabel')}</Label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="all">{t('catalog.allLevels')}</option>
                  <option value="beginner">{t('catalog.difficultyBeginner')}</option>
                  <option value="intermediate">{t('catalog.difficultyIntermediate')}</option>
                  <option value="advanced">{t('catalog.difficultyAdvanced')}</option>
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">{t('catalog.communitySortBy')}</Label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="popular">{t('catalog.sortMostPopular')}</option>
                  <option value="recent">{t('catalog.sortMostRecent')}</option>
                  <option value="rating">{t('catalog.sortHighestRated')}</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stack Grid */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">
              {searchQuery ? t('catalog.searchResultsCount', { count: filteredStacks.length }) : t('catalog.popularStacks')}
            </h2>
          </div>

          {searchQuery && searchStacksQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-label={t('catalog.loadingSearchResults')}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : searchStacksQuery.isError ? (
            <div className="text-center py-12" role="alert" aria-live="polite">
              <Layers3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium text-foreground mb-2">{t('catalog.failedToLoadStacks')}</h3>
              <p className="text-muted-foreground mb-4">
                {(searchStacksQuery.error as any)?.message || t('catalog.somethingWentWrong')}
              </p>
              <Button onClick={() => searchStacksQuery.refetch()}>{t('catalog.tryAgain')}</Button>
            </div>
          ) : filteredStacks.length === 0 ? (
            <div className="text-center py-12">
              <Layers3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-medium text-foreground mb-2">{t('catalog.noStacksFound')}</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery
                  ? t('catalog.noStacksMatchSearch', { query: searchQuery })
                  : t('catalog.tryAdjustingFilters')
                }
              </p>
              <Button onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedDifficulty('all');
              }}>
                {t('catalog.clearFilters')}
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
            <DialogTitle>{t('catalog.importCommunityStack')}</DialogTitle>
            <DialogDescription>
              {t('catalog.importDialogDesc', { name: selectedStack?.name ?? '' })}{' '}
              {t('catalog.currentStackReplaced')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-info/10 border border-info/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">{t('catalog.whatWillBeImported')}</h4>
              <ul className="text-sm text-foreground space-y-1">
                <li>• {t('catalog.servicesCount', { count: selectedStack?.services.length ?? 0 })}</li>
                <li>• {t('catalog.importItemConfigs')}</li>
                <li>• {t('catalog.importItemMetadata')}</li>
              </ul>
            </div>
            
            {currentServices.length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <p className="text-sm text-warning">
                  {t('catalog.workspaceReplaceWarning', { count: currentServices.length })}
                </p>
              </div>
            )}
            
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowImportDialog(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => selectedStack && handleImportStack(selectedStack)}
                disabled={isImporting}
              >
                {isImporting ? t('catalog.importing') : t('catalog.importStack')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommunityMarketplace;