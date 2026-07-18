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

  // Analyze current stack for optimization suggestions
  const analyzeStack = useMemo(() => {
    if (currentStackServices.length === 0) return null;

    const optimizations = [];
    const serviceCategories = new Set(currentStackServices.map(s => s.service.category?.slug));
    
    // Check for missing monitoring
    if (!currentStackServices.some(s => s.service.category?.slug === 'monitoring')) {
      optimizations.push({
        type: 'missing-monitoring',
        title: 'Add Monitoring',
        description: 'Consider adding monitoring tools like Prometheus or Grafana',
        priority: 'high',
        impact: 'Improved observability and debugging'
      });
    }

    // Check for security concerns
    if (currentStackServices.some(s => s.service.name.includes('database')) && 
        !currentStackServices.some(s => s.service.category?.slug === 'security')) {
      optimizations.push({
        type: 'security-gap',
        title: 'Security Enhancement',
        description: 'Add security tools for database protection',
        priority: 'high',
        impact: 'Better data protection and compliance'
      });
    }

    // Check for scalability
    if (currentStackServices.length > 5 && 
        !currentStackServices.some(s => s.service.category?.slug === 'load-balancer')) {
      optimizations.push({
        type: 'scalability',
        title: 'Load Balancing',
        description: 'Consider adding a load balancer for better distribution',
        priority: 'medium',
        impact: 'Improved performance and reliability'
      });
    }

    return optimizations;
  }, [currentStackServices]);

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
            Start your stack
          </CardTitle>
          <CardDescription>
            Pick a popular starting point, or add a service and we&apos;ll suggest what pairs well.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {starters.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Add a service to get compatibility-based recommendations.</p>
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
          Recommendations
        </CardTitle>
        <CardDescription>
          Services that pair well with what&apos;s already in your stack
        </CardDescription>
        
        {/* Tab Navigation — wrap so labels never clip in the narrow side panel */}
        <div className="flex flex-wrap gap-1 mt-4">
          {[
            { id: 'templates', label: 'Templates', icon: TrendingUp },
            { id: 'services', label: 'Services', icon: Zap },
            { id: 'optimizations', label: 'Optimize', icon: Target }
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
                  <p className="text-sm text-muted-foreground mt-2">Finding recommendations...</p>
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
                  <p>No template recommendations available</p>
                  <p className="text-xs mt-1">Try adding more services to your stack</p>
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
                        {Math.round(recommendation.confidence * 100)}% fit
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
                            {recommendation.estimatedSetupTime}min setup
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
                          {recommendation.difficulty}
                        </Badge>
                      </div>
                      
                      {recommendation.complementsServices.length > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Complements: </span>
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
                          Add Service <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {generateServiceRecommendations.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Your stack looks complete!</p>
                  <p className="text-xs mt-1">No immediate service recommendations</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'optimizations' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Stack Analysis</h4>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleAnalyzeStack}
                  disabled={isAnalyzing}
                  className="h-7"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
                </Button>
              </div>
              
              {analyzeStack && analyzeStack.length > 0 ? (
                analyzeStack.map((optimization, index) => (
                  <Card key={index} className="border-l-4 border-l-orange-500">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <AlertTriangle className={`h-4 w-4 ${getPriorityColor(optimization.priority)}`} />
                            {optimization.title}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {optimization.description}
                          </CardDescription>
                        </div>
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            optimization.priority === 'high' ? 'border-destructive/30 text-destructive' :
                            optimization.priority === 'medium' ? 'border-warning/30 text-warning' :
                            'border-success/30 text-success'
                          }`}
                        >
                          {optimization.priority}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">{optimization.impact}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
                  <p>Your stack is well optimized!</p>
                  <p className="text-xs mt-1">No immediate optimizations needed</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}