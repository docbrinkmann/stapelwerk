'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Plus, Users, Clock, Tag, Layers3, AlertCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useStackServices } from '@/stores/stack-builder';
import { useRecommendationAnalytics } from '@/lib/analytics/recommendation-analytics';
import type { Service } from '@/types/service';

interface StackTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * View model derived from the real `use_case_templates` payload (tRPC
 * `templates.getAll` / `templates.search`). The seeded catalog stores service
 * membership as `serviceIds` and connects the `services` relation, with tags
 * and per-service notes in `metadata`.
 */
interface TemplateVM {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  serviceIds: number[];
  serviceNames: string[];
  tags: string[];
  estimatedSetupTime?: string;
  usageCount: number;
}

function toTemplateVM(raw: any): TemplateVM {
  return {
    id: String(raw?.id),
    name: raw?.name ?? 'Untitled template',
    description: raw?.description ?? '',
    category: raw?.category ?? 'mixed',
    difficulty: raw?.difficulty ?? 'intermediate',
    serviceIds: Array.isArray(raw?.serviceIds) ? raw.serviceIds : [],
    serviceNames: Array.isArray(raw?.services)
      ? raw.services.map((s: any) => s?.name).filter(Boolean)
      : [],
    tags: Array.isArray(raw?.metadata?.tags) ? raw.metadata.tags : [],
    estimatedSetupTime: raw?.estimatedSetupTime,
    usageCount: typeof raw?.usageCount === 'number' ? raw.usageCount : 0,
  };
}

/**
 * Reshape a service row from `services.get` into the `Service` the builder
 * store expects: a category object and an `env` metadata array. Ports, env and
 * resource fields are already parsed by the endpoint; volumes stay tolerant of
 * a raw JSON string (the compose generator handles both).
 */
function toBuilderService(row: any): Service {
  return {
    ...row,
    category: row?.categories
      ? { id: row.categories.id, name: row.categories.name, slug: row.categories.slug }
      : { id: row?.categoryId ?? 0, name: typeof row?.category === 'string' ? row.category : '', slug: '' },
    env: Array.isArray(row?.environmentVariables) ? row.environmentVariables : [],
  } as unknown as Service;
}

export function StackTemplateModal({ isOpen, onClose }: StackTemplateModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);

  const { addService } = useStackServices();
  const analytics = useRecommendationAnalytics();
  const utils = trpc.useUtils();

  const [lastSearchTime, setLastSearchTime] = useState<number>(0);

  // API queries: server-side search when a query is present, otherwise the full
  // (optionally category-filtered) list.
  const {
    data: templatesData,
    isLoading,
    isError,
    error,
  } = searchQuery.length > 0
    ? trpc.templates.search.useQuery(
        {
          query: searchQuery,
          category: selectedCategory !== 'all' ? (selectedCategory as any) : undefined,
          sortBy: 'popularity',
          limit: 50,
        },
        { enabled: isOpen, refetchOnWindowFocus: false }
      )
    : trpc.templates.getAll.useQuery(
        {
          category: selectedCategory !== 'all' ? (selectedCategory as any) : undefined,
        },
        { enabled: isOpen, refetchOnWindowFocus: false }
      );

  const rawTemplates: any[] = Array.isArray(templatesData)
    ? templatesData
    : ((templatesData as any)?.templates ?? []);
  const templates: TemplateVM[] = rawTemplates.map(toTemplateVM);

  const categories: string[] = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  // Extra client-side filtering keeps the UI responsive while the query
  // refetches and matches tags the server search doesn't index.
  const filteredTemplates = templates.filter(template => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(q) ||
      template.description.toLowerCase().includes(q) ||
      template.serviceNames.some(name => name.toLowerCase().includes(q)) ||
      template.tags.some(tag => tag.toLowerCase().includes(q));

    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleApplyTemplate = async (template: TemplateVM) => {
    setApplyingTemplateId(template.id);

    try {
      // Resolve each member service in the shape the builder store consumes,
      // then add it. This populates the live builder (canvas + docker-compose
      // preview) with the real, seeded services.
      const rows = await Promise.all(
        template.serviceIds.map(id => utils.services.get.fetch({ id }))
      );

      rows.forEach(row => addService(toBuilderService(row)));

      analytics.trackTemplateApplied?.(
        template.id,
        template.name,
        template.category,
        rows.map(r => String((r as any)?.id)),
        'browse',
        Date.now() - lastSearchTime,
        'template_modal'
      );

      onClose();
    } catch (err) {
      console.error('Failed to apply template:', err);
    } finally {
      setApplyingTemplateId(null);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-success/10 text-success';
      case 'intermediate':
        return 'bg-warning/10 text-warning';
      case 'advanced':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Stack Templates</DialogTitle>
          <DialogDescription>
            Start from a curated, ready-to-deploy composition — applying one adds its services to your stack
          </DialogDescription>
        </DialogHeader>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => {
                const newQuery = e.target.value;
                setSearchQuery(newQuery);

                const currentTime = Date.now();
                if (currentTime - lastSearchTime > 1000) {
                  setLastSearchTime(currentTime);
                  if (newQuery.length > 2) {
                    analytics.trackSearch?.(newQuery, filteredTemplates.length, 'template_modal');
                  }
                }
              }}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {categories.map((category: string) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSelectedCategory(category);
                  analytics.trackFilter?.('category', category, filteredTemplates.length, 'template_modal');
                }}
              >
                {category === 'all' ? 'All' : category}
              </Button>
            ))}
          </div>
        </div>

        {/* Templates Grid */}
        <ScrollArea className="h-96">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading templates...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-8 text-destructive">
              <AlertCircle className="h-6 w-6 mr-2" />
              <div>
                <p>Failed to load templates</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error?.message || 'Please try again later'}
                </p>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No templates found matching your criteria.</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="h-fit">
                  <CardHeader>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription className="mt-1">{template.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Services */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Layers3 className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Services ({template.serviceNames.length || template.serviceIds.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {template.serviceNames.slice(0, 4).map((service) => (
                          <Badge key={service} variant="secondary" className="text-xs">
                            {service}
                          </Badge>
                        ))}
                        {template.serviceNames.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.serviceNames.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    {template.tags.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Tag className="h-4 w-4" />
                          <span className="text-sm font-medium">Tags</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {template.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {template.usageCount.toLocaleString()} uses
                      </div>
                      {template.estimatedSetupTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {template.estimatedSetupTime}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="flex justify-between items-center">
                    <Badge className={`capitalize ${getDifficultyColor(template.difficulty)}`}>
                      {template.difficulty}
                    </Badge>

                    <Button
                      size="sm"
                      onClick={() => handleApplyTemplate(template)}
                      disabled={applyingTemplateId !== null}
                    >
                      {applyingTemplateId === template.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Applying...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-1" />
                          Apply
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
