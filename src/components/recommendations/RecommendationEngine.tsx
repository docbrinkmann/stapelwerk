'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Lightbulb, 
  TrendingUp, 
  Users, 
  Star, 
  ChevronRight, 
  Zap,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { useStackServices } from '@/stores/stack-builder';
import { useRecommendationAnalytics } from '@/lib/analytics/recommendation-analytics';
import { useT } from '@/lib/i18n/client';
import {
  generateStackOptimizations,
  SUGGESTION_LABELS,
} from '@/lib/recommendations/stack-optimizations';

interface RecommendationEngineProps {
  className?: string;
  onTemplateSelect?: (templateId: string) => void;
  onServiceRecommend?: (service: any) => void;
  maxRecommendations?: number;
  showPersonalized?: boolean;
}

interface ServiceRecommendation {
  id: string;
  name: string;
  description: string;
  category: string;
  confidence: number;
  reasoning: string;
  complementsServices: string[];
  estimatedSetupTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  service?: any;
}

interface TemplateRecommendation {
  id: string;
  name: string;
  description: string;
  category: string;
  confidence: number;
  reasoning: string;
  matchingServices: string[];
  additionalServices: string[];
  rating: number;
  downloads: number;
}

export function RecommendationEngine({
  className = '',
  onTemplateSelect,
  onServiceRecommend,
  maxRecommendations = 5,
  showPersonalized = true
}: RecommendationEngineProps) {
  const [activeTab, setActiveTab] = useState<'templates' | 'services' | 'optimizations'>('templates');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewStartTime] = useState(Date.now());
  
  const { services: currentStackServices } = useStackServices();
  const analytics = useRecommendationAnalytics();
  const utils = trpc.useUtils();
  // One-click apply state for optimization suggestions.
  const [applyingSlug, setApplyingSlug] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const currentServiceIds = useMemo(
    () => currentStackServices
      .map((s: any) => Number(s?.id ?? s?.serviceId ?? s?.service?.id))
      .filter((n: number) => Number.isFinite(n) && n > 0),
    [currentStackServices]
  );

  // Get recommendations from API
  const { 
    data: recommendationsData, 
    isLoading: isLoadingRecommendations,
    refetch: refetchRecommendations
  } = trpc.templates.getRecommendations.useQuery({
    currentServices: currentServiceIds,
    maxResults: maxRecommendations,
    includePersonalized: showPersonalized
  }, {
    // Gate on the filtered ids: draft services can carry non-numeric ids,
    // and the router schema requires at least one numeric id (400 otherwise).
    enabled: currentServiceIds.length > 0,
    refetchOnWindowFocus: false
  });

  // Get trending templates
  const { data: trendingData } = trpc.templates.getPopular.useQuery({
    limit: 3
  });

  // Real, compatibility-scored service recommendations for the live draft
  // (server-side RecommendationService: compatibleWith/incompatibleWith +
  // rationale). Replaces the old hardcoded client-side category heuristics.
  const { data: liveServiceRecs } = trpc.recommendations.getForServices.useQuery(
    { serviceIds: currentServiceIds, limit: maxRecommendations },
    { enabled: currentServiceIds.length > 0, refetchOnWindowFocus: false }
  );

  // Applicable optimization suggestions — pure lib, tolerant of the category
  // shapes services actually arrive in; each suggestion carries addable slugs.
  const optimizations = useMemo(
    () => generateStackOptimizations(currentStackServices),
    [currentStackServices]
  );

  // One-click apply: fetch the suggested catalog service and hand it to the
  // builder exactly like a service recommendation.
  const handleApplyOptimization = async (slug: string) => {
    setApplyingSlug(slug);
    setApplyError(null);
    try {
      const service = await utils.services.getBySlug.fetch({ slug });
      onServiceRecommend?.(service);
    } catch {
      setApplyError(t('builder.recAddFailed', { name: SUGGESTION_LABELS[slug] ?? slug }));
    } finally {
      setApplyingSlug(null);
    }
  };

  // Map the server's compatibility-scored recommendations (with rationale) into
  // the display shape. Each carries the full catalog service so "Add" can drop
  // it straight into the builder.
  const generateServiceRecommendations = useMemo((): ServiceRecommendation[] => {
    return (liveServiceRecs ?? []).map((rec: any): ServiceRecommendation => {
      const svc = rec.service ?? {}
      return {
        id: String(rec.serviceId ?? svc.id ?? ''),
        name: svc.name ?? 'Service',
        description: svc.description ?? '',
        category: svc.categories?.name ?? svc.category?.name ?? String(rec.category ?? ''),
        confidence: typeof rec.score === 'number' ? rec.score : 0,
        reasoning: rec.rationale ?? '',
        complementsServices: [],
        estimatedSetupTime: typeof svc.setupTime === 'number' ? svc.setupTime : 0,
        difficulty: (svc.difficulty as ServiceRecommendation['difficulty']) ?? 'beginner',
        service: svc,
      }
    })
  }, [liveServiceRecs]);

  const handleAnalyzeStack = async () => {
    setIsAnalyzing(true);
    
    // Track re-analysis action
    analytics.trackOptimization(
      'performance',
      'medium',
      currentStackServices.length,
      'recommendation_engine',
      'applied'
    );
    
    try {
      await refetchRecommendations();
      // Simulate analysis time for UX
      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-success/10 text-success';
    if (confidence >= 0.6) return 'bg-warning/10 text-warning';
    return 'bg-destructive/10 text-destructive';
  };

  const t = useT();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-warning';
      default: return 'text-success';
    }
  };

  if (currentStackServices.length === 0) {
    const starters = (trendingData ?? []).slice(0, 3);
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            {t('builder.recStartTitle')}
          </CardTitle>
          <CardDescription>
            {t('builder.recStartBody')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {starters.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t('builder.recStartEmpty')}</p>
            </div>
          ) : (
            starters.map((tpl: any) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onTemplateSelect?.(String(tpl.id))}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="font-medium">{tpl.name}</p>
                  {tpl.description && (
                    <p className="truncate text-sm text-muted-foreground">{tpl.description}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          {t('builder.recTitle')}
        </CardTitle>
        <CardDescription>
          {t('builder.recSubtitle')}
        </CardDescription>
        
        {/* Tab Navigation — wrap so labels never clip in the narrow side panel */}
        <div className="flex flex-wrap gap-1 mt-4">
          {[
            { id: 'templates', label: t('builder.recTabTemplates'), icon: TrendingUp },
            { id: 'services', label: t('builder.recTabServices'), icon: Zap },
            { id: 'optimizations', label: t('builder.recTabOptimize'), icon: Target }
          ].map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={activeTab === id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                const newTab = id as typeof activeTab;
                setActiveTab(newTab);
                
                // Track tab switch for analytics
                analytics.trackRecommendationViewed(
                  newTab === 'templates' ? 'template' : 
                  newTab === 'services' ? 'service' : 'optimization',
                  `tab_${newTab}`,
                  1,
                  0,
                  'recommendation_engine',
                  {
                    currentStackSize: currentStackServices.length,
                    currentStackServices: currentStackServices.map(s => s.service.name)
                  }
                );
              }}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-80">
          {activeTab === 'templates' && (
            <div className="space-y-4">
              {isLoadingRecommendations ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">{t('builder.recFinding')}</p>
                </div>
              ) : (Array.isArray(recommendationsData) && recommendationsData.length > 0) ? (
                recommendationsData.map((rec: any, idx: number) => {
                  const template: TemplateRecommendation = {
                    id: rec.template.id,
                    name: rec.template.name,
                    description: rec.template.description,
                    category: rec.template.category,
                    confidence: rec.score ?? 0.7,
                    reasoning: rec.reason ?? 'Compatible with current stack',
                    matchingServices: (rec.matchingServices || []).map(String),
                    additionalServices: (rec.newServices || []).map(String),
                    rating: (rec.template.metadata?.rating as number) || 0,
                    downloads: (rec.template.usageCount as number) || 0,
                  } as any;

                  return (
                    <Card key={template.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            <CardDescription className="text-sm">
                              {template.description}
                            </CardDescription>
                          </div>
                          <Badge className={getConfidenceColor(template.confidence)}>
                            {Math.round(template.confidence * 100)}% match
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{template.reasoning}</p>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {template.rating}
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {template.downloads.toLocaleString()} downloads
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center mt-3">
                            <div className="flex gap-1">
                              {template.matchingServices.slice(0, 3).map(service => (
                                <Badge key={service} variant="secondary" className="text-xs">
                                  {service}
                                </Badge>
                              ))}
                              {template.matchingServices.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.matchingServices.length - 3} more
                                </Badge>
                              )}
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                // Track template recommendation click
                                analytics.trackRecommendationClicked(
                                  'template',
                                  template.id,
                                  template.confidence,
                                  idx,
                                  'apply',
                                  'recommendation_engine'
                                );
                                onTemplateSelect?.(template.id);
                              }}
                              className="h-7"
                            >
                              Apply <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>{t('builder.recNoTemplates')}</p>
                  <p className="text-xs mt-1">{t('builder.recTryMore')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-4">
              {generateServiceRecommendations.map((recommendation) => (
                <Card key={recommendation.id} className="border-l-4 border-l-success">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{recommendation.name}</CardTitle>
                        <CardDescription className="text-sm">
                          {recommendation.description}
                        </CardDescription>
                      </div>
                      <Badge className={getConfidenceColor(recommendation.confidence)}>
                        {t('builder.recFitBadge', { pct: Math.round(recommendation.confidence * 100) })}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">{recommendation.reasoning}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {recommendation.estimatedSetupTime > 0 && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t('builder.recSetupTime', { min: recommendation.estimatedSetupTime })}
                          </div>
                        )}
                        <Badge
                          variant="outline" 
                          className={`text-xs ${
                            recommendation.difficulty === 'beginner' ? 'border-success/30' :
                            recommendation.difficulty === 'intermediate' ? 'border-warning/30' :
                            'border-destructive/30'
                          }`}
                        >
                          {t(
                            recommendation.difficulty === 'advanced'
                              ? 'builder.difficultyAdvanced'
                              : recommendation.difficulty === 'intermediate'
                                ? 'builder.difficultyIntermediate'
                                : 'builder.difficultyBeginner'
                          )}
                        </Badge>
                      </div>
                      
                      {recommendation.complementsServices.length > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">{t('builder.recComplements')} </span>
                          {recommendation.complementsServices.join(', ')}
                        </div>
                      )}
                      
                      <div className="flex justify-end mt-3">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            // Track service recommendation click
                            analytics.trackRecommendationClicked(
                              'service',
                              recommendation.id,
                              recommendation.confidence,
                              generateServiceRecommendations.indexOf(recommendation),
                              'add_service',
                              'recommendation_engine'
                            );
                            onServiceRecommend?.(recommendation.service ?? recommendation.id);
                          }}
                          className="h-7"
                        >
                          {t('builder.recAddService')} <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {generateServiceRecommendations.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('builder.recComplete')}</p>
                  <p className="text-xs mt-1">{t('builder.recNoServiceRecs')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'optimizations' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">{t('builder.recAnalysis')}</h4>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleAnalyzeStack}
                  disabled={isAnalyzing}
                  className="h-7"
                >
                  {isAnalyzing ? t('builder.recAnalyzing') : t('builder.recReanalyze')}
                </Button>
              </div>
              
              {applyError && (
                <p role="alert" className="text-xs text-destructive">{applyError}</p>
              )}
              {optimizations.length > 0 ? (
                optimizations.map((optimization, index) => (
                  <Card key={index} className="border-l-4 border-l-orange-500">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className={`h-4 w-4 ${getPriorityColor(optimization.priority)}`} />
                            {t(optimization.titleKey)}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {t(optimization.descriptionKey)}
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            optimization.priority === 'high' ? 'border-destructive/30 text-destructive' :
                            'border-warning/30 text-warning'
                          }`}
                        >
                          {t(optimization.priority === 'high' ? 'builder.priorityHigh' : 'builder.priorityMedium')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{t('builder.optImpactLabel')}</span>{' '}
                        {t(optimization.impactKey)}
                      </p>
                      {/* One-click apply: add a concrete suggested service. */}
                      <div className="flex flex-wrap gap-2">
                        {optimization.suggestedSlugs.map(slug => (
                          <Button
                            key={slug}
                            size="sm"
                            variant="outline"
                            className="h-7"
                            disabled={applyingSlug !== null}
                            onClick={() => handleApplyOptimization(slug)}
                            data-testid={`apply-optimization-${slug}`}
                          >
                            {applyingSlug === slug
                              ? t('common.loading')
                              : t('builder.optAdd', { name: SUGGESTION_LABELS[slug] ?? slug })}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
                  <p>{t('builder.recOptimized')}</p>
                  <p className="text-xs mt-1">{t('builder.recNoOptimizations')}</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}