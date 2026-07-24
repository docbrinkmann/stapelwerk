/**
 * Recommendation Analytics Service
 * Tracks user interactions with recommendations for continuous improvement
 */

export interface RecommendationEventData {
  userId?: string;
  sessionId: string;
  timestamp: Date;
  eventType: RecommendationEventType;
  data: RecommendationEvent;
}

export type RecommendationEventType = 
  | 'recommendation_viewed'
  | 'recommendation_clicked'
  | 'template_applied'
  | 'service_added'
  | 'recommendation_dismissed'
  | 'feedback_provided'
  | 'search_performed'
  | 'filter_applied'
  | 'optimization_viewed';

export interface BaseRecommendationEvent {
  eventId: string;
  source: 'template_modal' | 'recommendation_engine' | 'stack_builder';
  context?: {
    currentStackSize: number;
    currentStackServices: string[];
    userAgent?: string;
    screenSize?: string;
  };
}

export interface RecommendationViewedEvent extends BaseRecommendationEvent {
  recommendationType: 'template' | 'service' | 'optimization';
  recommendationId: string;
  confidence: number;
  position: number; // Position in the recommendation list
  category?: string;
}

export interface RecommendationClickedEvent extends BaseRecommendationEvent {
  recommendationType: 'template' | 'service' | 'optimization';
  recommendationId: string;
  confidence: number;
  position: number;
  action: 'view_details' | 'apply' | 'add_service' | 'learn_more';
}

export interface TemplateAppliedEvent extends BaseRecommendationEvent {
  templateId: string;
  templateName: string;
  templateCategory: string;
  servicesAdded: string[];
  applicationMethod: 'recommendation' | 'browse' | 'search';
  timeToDecision: number; // Time from recommendation view to application (ms)
}

export interface ServiceAddedEvent extends BaseRecommendationEvent {
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  additionMethod: 'recommendation' | 'catalog' | 'template';
  confidence?: number;
  reasoning?: string;
}

export interface FeedbackProvidedEvent extends BaseRecommendationEvent {
  recommendationType: 'template' | 'service' | 'optimization';
  recommendationId: string;
  feedbackType: 'positive' | 'negative' | 'not_helpful' | 'helpful';
  feedbackComment?: string;
}

export interface SearchPerformedEvent extends BaseRecommendationEvent {
  query: string;
  resultCount: number;
  selectedResult?: string;
  timeToSelection?: number;
}

export interface FilterAppliedEvent extends BaseRecommendationEvent {
  filterType: 'category' | 'difficulty' | 'popularity';
  filterValue: string;
  resultCount: number;
}

export interface OptimizationViewedEvent extends BaseRecommendationEvent {
  optimizationType: 'missing-monitoring' | 'security-gap' | 'scalability' | 'performance';
  priority: 'high' | 'medium' | 'low';
  stackSize: number;
  actionTaken?: 'dismissed' | 'applied' | 'deferred';
}

export type RecommendationEvent = 
  | RecommendationViewedEvent
  | RecommendationClickedEvent
  | TemplateAppliedEvent
  | ServiceAddedEvent
  | FeedbackProvidedEvent
  | SearchPerformedEvent
  | FilterAppliedEvent
  | OptimizationViewedEvent;

class RecommendationAnalyticsService {
  private sessionId: string;
  private events: RecommendationEventData[] = [];
  private batchSize = 10;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;
  private isEnabled = true;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeAnalytics();
    this.startPeriodicFlush();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeAnalytics(): void {
    // Check if analytics are enabled (respect user privacy settings)
    if (typeof window !== 'undefined') {
      const analyticsEnabled = localStorage.getItem('analytics_enabled');
      this.isEnabled = analyticsEnabled !== 'false';
      
      // Track page view for recommendation system
      if (this.isEnabled) {
        this.trackEvent('recommendation_viewed', {
          eventId: this.generateEventId(),
          source: 'stack_builder',
          recommendationType: 'optimization',
          recommendationId: 'system_initialization',
          confidence: 1,
          position: 0,
          context: this.getContext()
        } as RecommendationViewedEvent);
      }
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getContext() {
    if (typeof window === 'undefined') return {};
    
    return {
      currentStackSize: 0, // Will be updated by components
      currentStackServices: [],
      userAgent: navigator.userAgent,
      screenSize: `${window.screen.width}x${window.screen.height}`
    };
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Track a recommendation event
   */
  trackEvent(eventType: RecommendationEventType, eventData: RecommendationEvent): void {
    if (!this.isEnabled) return;

    const event: RecommendationEventData = {
      sessionId: this.sessionId,
      timestamp: new Date(),
      eventType,
      data: eventData
    };

    // Add to local buffer
    this.events.push(event);

    // Log to console in development and test environments
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      console.log('📊 Recommendation Analytics:', eventType, eventData);
    }

    // Flush if batch size reached
    if (this.events.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Track recommendation view
   */
  trackRecommendationViewed(
    type: 'template' | 'service' | 'optimization',
    recommendationId: string,
    confidence: number,
    position: number,
    source: BaseRecommendationEvent['source'],
    context?: BaseRecommendationEvent['context']
  ): void {
    this.trackEvent('recommendation_viewed', {
      eventId: this.generateEventId(),
      source,
      recommendationType: type,
      recommendationId,
      confidence,
      position,
      context: context || this.getContext()
    } as RecommendationViewedEvent);
  }

  /**
   * Track recommendation click
   */
  trackRecommendationClicked(
    type: 'template' | 'service' | 'optimization',
    recommendationId: string,
    confidence: number,
    position: number,
    action: RecommendationClickedEvent['action'],
    source: BaseRecommendationEvent['source']
  ): void {
    this.trackEvent('recommendation_clicked', {
      eventId: this.generateEventId(),
      source,
      recommendationType: type,
      recommendationId,
      confidence,
      position,
      action,
      context: this.getContext()
    } as RecommendationClickedEvent);
  }

  /**
   * Track template application
   */
  trackTemplateApplied(
    templateId: string,
    templateName: string,
    templateCategory: string,
    servicesAdded: string[],
    applicationMethod: TemplateAppliedEvent['applicationMethod'],
    timeToDecision: number,
    source: BaseRecommendationEvent['source']
  ): void {
    this.trackEvent('template_applied', {
      eventId: this.generateEventId(),
      source,
      templateId,
      templateName,
      templateCategory,
      servicesAdded,
      applicationMethod,
      timeToDecision,
      context: this.getContext()
    } as TemplateAppliedEvent);
  }

  /**
   * Track service addition
   */
  trackServiceAdded(
    serviceId: string,
    serviceName: string,
    serviceCategory: string,
    additionMethod: ServiceAddedEvent['additionMethod'],
    source: BaseRecommendationEvent['source'],
    confidence?: number,
    reasoning?: string
  ): void {
    this.trackEvent('service_added', {
      eventId: this.generateEventId(),
      source,
      serviceId,
      serviceName,
      serviceCategory,
      additionMethod,
      confidence,
      reasoning,
      context: this.getContext()
    } as ServiceAddedEvent);
  }

  /**
   * Track user feedback
   */
  trackFeedback(
    type: 'template' | 'service' | 'optimization',
    recommendationId: string,
    feedbackType: FeedbackProvidedEvent['feedbackType'],
    source: BaseRecommendationEvent['source'],
    comment?: string
  ): void {
    this.trackEvent('feedback_provided', {
      eventId: this.generateEventId(),
      source,
      recommendationType: type,
      recommendationId,
      feedbackType,
      feedbackComment: comment,
      context: this.getContext()
    } as FeedbackProvidedEvent);
  }

  /**
   * Track search activity
   */
  trackSearch(
    query: string,
    resultCount: number,
    source: BaseRecommendationEvent['source'],
    selectedResult?: string,
    timeToSelection?: number
  ): void {
    this.trackEvent('search_performed', {
      eventId: this.generateEventId(),
      source,
      query,
      resultCount,
      selectedResult,
      timeToSelection,
      context: this.getContext()
    } as SearchPerformedEvent);
  }

  /**
   * Track filter usage
   */
  trackFilter(
    filterType: FilterAppliedEvent['filterType'],
    filterValue: string,
    resultCount: number,
    source: BaseRecommendationEvent['source']
  ): void {
    this.trackEvent('filter_applied', {
      eventId: this.generateEventId(),
      source,
      filterType,
      filterValue,
      resultCount,
      context: this.getContext()
    } as FilterAppliedEvent);
  }

  /**
   * Track optimization suggestions
   */
  trackOptimization(
    optimizationType: OptimizationViewedEvent['optimizationType'],
    priority: OptimizationViewedEvent['priority'],
    stackSize: number,
    source: BaseRecommendationEvent['source'],
    actionTaken?: OptimizationViewedEvent['actionTaken']
  ): void {
    this.trackEvent('optimization_viewed', {
      eventId: this.generateEventId(),
      source,
      optimizationType,
      priority,
      stackSize,
      actionTaken,
      context: this.getContext()
    } as OptimizationViewedEvent);
  }

  /**
   * Update context for current session
   */
  updateContext(context: Partial<BaseRecommendationEvent['context']>): void {
    if (this.events.length > 0) {
      // Update the most recent event's context if it exists
      const lastEvent = this.events[this.events.length - 1];
      if (lastEvent.data.context) {
        Object.assign(lastEvent.data.context, context);
      }
    }
  }

  /**
   * Flush events to analytics backend
   */
  private async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      // Send to analytics backend (could be Google Analytics, PostHog, etc.)
      await this.sendToBackend(eventsToSend);
      
      // Store in local storage for offline support
      this.storeLocally(eventsToSend);
    } catch (error) {
      console.error('Failed to send recommendation analytics:', error);
      // Re-add events back to queue for retry
      this.events.unshift(...eventsToSend);
    }
  }

  private async sendToBackend(events: RecommendationEventData[]): Promise<void> {
    if (typeof window === 'undefined') return;

    // Send to your analytics backend
    const response = await fetch('/api/analytics/recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events })
    });

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }
  }

  private storeLocally(events: RecommendationEventData[]): void {
    if (typeof window === 'undefined') return;

    try {
      const existingEvents = localStorage.getItem('recommendation_analytics') || '[]';
      const parsedEvents = JSON.parse(existingEvents);
      const updatedEvents = [...parsedEvents, ...events].slice(-1000); // Keep last 1000 events
      
      localStorage.setItem('recommendation_analytics', JSON.stringify(updatedEvents));
    } catch (error) {
      console.warn('Failed to store analytics locally:', error);
    }
  }

  /**
   * Get analytics summary for debugging
   */
  getAnalyticsSummary(): {
    sessionId: string;
    eventCount: number;
    pendingEvents: number;
    isEnabled: boolean;
    lastFlush: Date | null;
  } {
    return {
      sessionId: this.sessionId,
      eventCount: this.events.length,
      pendingEvents: this.events.length,
      isEnabled: this.isEnabled,
      lastFlush: new Date()
    };
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('analytics_enabled', enabled.toString());
    }
  }

  /**
   * Reset service state for testing
   */
  reset(): void {
    this.events = [];
    this.sessionId = this.generateSessionId();
    this.isEnabled = true;
    
    // Clear localStorage if available
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('recommendation_analytics');
      window.localStorage.removeItem('analytics_enabled');
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush before cleanup
  }
}

// Singleton instance
export const recommendationAnalytics = new RecommendationAnalyticsService();

// React hook for easy integration
export function useRecommendationAnalytics() {
  return {
    trackRecommendationViewed: recommendationAnalytics.trackRecommendationViewed.bind(recommendationAnalytics),
    trackRecommendationClicked: recommendationAnalytics.trackRecommendationClicked.bind(recommendationAnalytics),
    trackTemplateApplied: recommendationAnalytics.trackTemplateApplied.bind(recommendationAnalytics),
    trackServiceAdded: recommendationAnalytics.trackServiceAdded.bind(recommendationAnalytics),
    trackFeedback: recommendationAnalytics.trackFeedback.bind(recommendationAnalytics),
    trackSearch: recommendationAnalytics.trackSearch.bind(recommendationAnalytics),
    trackFilter: recommendationAnalytics.trackFilter.bind(recommendationAnalytics),
    trackOptimization: recommendationAnalytics.trackOptimization.bind(recommendationAnalytics),
    updateContext: recommendationAnalytics.updateContext.bind(recommendationAnalytics),
    getSummary: recommendationAnalytics.getAnalyticsSummary.bind(recommendationAnalytics),
    setEnabled: recommendationAnalytics.setEnabled.bind(recommendationAnalytics)
  };
}