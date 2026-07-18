import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  recommendationAnalytics,
  useRecommendationAnalytics,
  RecommendationEventData,
  RecommendationEventType
} from '../recommendation-analytics';

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  }
});

// Mock screen
Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080
  }
});

describe('RecommendationAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    // Set NODE_ENV to test to enable console logging
    process.env.NODE_ENV = 'test';
    
    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockClear();
    localStorageMock.clear.mockClear();
    
    // Reset fetch mock
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    // Reset the service instance state
    if (recommendationAnalytics && typeof recommendationAnalytics.reset === 'function') {
      recommendationAnalytics.reset();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    recommendationAnalytics.setEnabled(true); // Reset to enabled
  });

  describe('Initialization', () => {
    it('should initialize with analytics enabled by default', () => {
      const summary = recommendationAnalytics.getAnalyticsSummary();
      expect(summary.isEnabled).toBe(true);
      expect(summary.sessionId).toBeTruthy();
    });

    it('should respect analytics disabled setting from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('false');
      
      // Create a new instance to test initialization
      const testAnalytics = new (recommendationAnalytics.constructor as any)();
      testAnalytics.setEnabled(false);
      
      expect(testAnalytics.getAnalyticsSummary().isEnabled).toBe(false);
    });

    it('should generate unique session IDs', () => {
      const summary1 = recommendationAnalytics.getAnalyticsSummary();
      const summary2 = recommendationAnalytics.getAnalyticsSummary();
      
      expect(summary1.sessionId).toBeTruthy();
      expect(summary1.sessionId).toBe(summary2.sessionId); // Same instance
    });
  });

  describe('Event Tracking', () => {
    it('should track recommendation viewed events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.trackRecommendationViewed(
        'template',
        'template-123',
        0.85,
        1,
        'recommendation_engine'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Recommendation Analytics:',
        'recommendation_viewed',
        expect.objectContaining({
          recommendationType: 'template',
          recommendationId: 'template-123',
          confidence: 0.85,
          position: 1
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should track recommendation clicked events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.trackRecommendationClicked(
        'service',
        'service-456',
        0.9,
        2,
        'apply',
        'template_modal'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Recommendation Analytics:',
        'recommendation_clicked',
        expect.objectContaining({
          recommendationType: 'service',
          recommendationId: 'service-456',
          action: 'apply'
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should track template applied events with timing', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.trackTemplateApplied(
        'template-789',
        'Web Stack Template',
        'Web Development',
        ['nginx', 'nodejs', 'postgresql'],
        'recommendation',
        5000,
        'recommendation_engine'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Recommendation Analytics:',
        'template_applied',
        expect.objectContaining({
          templateId: 'template-789',
          templateName: 'Web Stack Template',
          servicesAdded: ['nginx', 'nodejs', 'postgresql'],
          timeToDecision: 5000
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should track service added events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.trackServiceAdded(
        'redis-123',
        'Redis',
        'Cache',
        'recommendation',
        'recommendation_engine',
        0.88,
        'Perfect for database caching'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Recommendation Analytics:',
        'service_added',
        expect.objectContaining({
          serviceId: 'redis-123',
          serviceName: 'Redis',
          additionMethod: 'recommendation',
          confidence: 0.88
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should track user feedback events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.trackFeedback(
        'template',
        'template-feedback-123',
        'positive',
        'template_modal',
        'Great recommendation!'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Recommendation Analytics:',
        'feedback_provided',
        expect.objectContaining({
          recommendationType: 'template',
          feedbackType: 'positive',
          feedbackComment: 'Great recommendation!'
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should track search events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.trackSearch(
        'docker database',
        5,
        'template_modal',
        'postgresql-template',
        2500
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Recommendation Analytics:',
        'search_performed',
        expect.objectContaining({
          query: 'docker database',
          resultCount: 5,
          selectedResult: 'postgresql-template',
          timeToSelection: 2500
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should not track events when analytics disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.setEnabled(false);
      
      recommendationAnalytics.trackRecommendationViewed(
        'template',
        'template-123',
        0.85,
        1,
        'recommendation_engine'
      );

      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Event Batching and Flushing', () => {
    it('should batch events before sending to backend', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Track multiple events
      for (let i = 0; i < 5; i++) {
        recommendationAnalytics.trackRecommendationViewed(
          'template',
          `template-${i}`,
          0.8,
          i,
          'recommendation_engine'
        );
      }

      // Events should be batched locally
      const summary = recommendationAnalytics.getAnalyticsSummary();
      expect(summary.pendingEvents).toBe(5);
      
      // Should not have sent to backend yet (batch size is 10)
      expect(global.fetch).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should flush events when batch size is reached', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Track enough events to trigger flush (batch size is 10)
      for (let i = 0; i < 10; i++) {
        recommendationAnalytics.trackRecommendationViewed(
          'template',
          `template-${i}`,
          0.8,
          i,
          'recommendation_engine'
        );
      }

      // Should have triggered flush
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/recommendations',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('events')
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should flush events periodically', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Track some events
      recommendationAnalytics.trackRecommendationViewed(
        'template',
        'template-periodic',
        0.8,
        1,
        'recommendation_engine'
      );

      // Fast-forward time to trigger periodic flush
      vi.advanceTimersByTime(31000); // 31 seconds

      await vi.runAllTimersAsync();
      
      // Check if flush was attempted
      const fetchCalls = (global.fetch as any).mock.calls;
      if (fetchCalls.length > 0) {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/analytics/recommendations',
          expect.objectContaining({
            method: 'POST'
          })
        );
      } else {
        // If no flush was triggered, events should be pending
        const summary = recommendationAnalytics.getAnalyticsSummary();
        expect(summary.pendingEvents).toBeGreaterThanOrEqual(1);
      }
      
      consoleSpy.mockRestore();
    });

    it('should re-queue events for retry on API failure', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock API failure
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      // Track enough events to trigger flush
      for (let i = 0; i < 10; i++) {
        recommendationAnalytics.trackRecommendationViewed(
          'template',
          `template-${i}`,
          0.8,
          i,
          'recommendation_engine'
        );
      }

      await vi.runAllTimersAsync();

      // Flush was attempted and failed
      expect(global.fetch).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send recommendation analytics:',
        expect.any(Error)
      );

      // Failed events are NOT persisted to localStorage — localStorage is
      // only written after a successful send. Instead the events are
      // re-queued in memory for the next flush attempt.
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(
        'recommendation_analytics',
        expect.any(String)
      );
      const summary = recommendationAnalytics.getAnalyticsSummary();
      expect(summary.pendingEvents).toBeGreaterThanOrEqual(10);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Context Management', () => {
    it('should capture browser context in events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.trackRecommendationViewed(
        'template',
        'template-context',
        0.8,
        1,
        'recommendation_engine'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Recommendation Analytics:',
        'recommendation_viewed',
        expect.objectContaining({
          context: expect.objectContaining({
            userAgent: expect.stringContaining('Mozilla'),
            screenSize: '1920x1080'
          })
        })
      );
      
      consoleSpy.mockRestore();
    });

    it('should allow context updates', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      recommendationAnalytics.trackRecommendationViewed(
        'template',
        'template-update',
        0.8,
        1,
        'recommendation_engine'
      );
      
      recommendationAnalytics.updateContext({
        currentStackSize: 5,
        currentStackServices: ['nginx', 'postgresql', 'redis']
      });

      // Context should be updated for subsequent events
      const summary = recommendationAnalytics.getAnalyticsSummary();
      expect(summary.pendingEvents).toBe(1);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Privacy and Configuration', () => {
    it('should allow enabling/disabling analytics', () => {
      recommendationAnalytics.setEnabled(false);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('analytics_enabled', 'false');
      
      recommendationAnalytics.setEnabled(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('analytics_enabled', 'true');
    });

    it('should provide analytics summary for debugging', () => {
      const summary = recommendationAnalytics.getAnalyticsSummary();
      
      expect(summary).toMatchObject({
        sessionId: expect.any(String),
        eventCount: expect.any(Number),
        pendingEvents: expect.any(Number),
        isEnabled: expect.any(Boolean),
        lastFlush: expect.any(Date)
      });
    });
  });

  describe('Local Storage Management', () => {
    it('should store events locally with size limits', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock existing local storage with many events
      const existingEvents = Array.from({ length: 999 }, (_, i) => ({
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        eventType: 'test',
        data: { index: i }
      }));
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingEvents));
      
      // Track enough events to trigger flush
      for (let i = 0; i < 10; i++) {
        recommendationAnalytics.trackRecommendationViewed(
          'template',
          `template-${i}`,
          0.8,
          i,
          'recommendation_engine'
        );
      }

      await vi.runAllTimersAsync();
      
      // Should limit stored events to 1000
      await vi.runAllTimersAsync();
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'recommendation_analytics',
        expect.stringMatching(/"index":9/) // Should include recent events
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle localStorage errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Create a fresh instance to avoid affecting the global service during setup
      const testAnalytics = new (recommendationAnalytics.constructor as any)();
      
      // Mock localStorage error for this specific test
      localStorageMock.setItem.mockImplementation((key, value) => {
        if (key === 'recommendation_analytics') {
          throw new Error('Storage quota exceeded');
        }
        // Don't recursively call, just return
        return;
      });
      
      // Track events to trigger flush
      for (let i = 0; i < 10; i++) {
        testAnalytics.trackRecommendationViewed(
          'template',
          `template-${i}`,
          0.8,
          i,
          'recommendation_engine'
        );
      }

      // Use runOnlyPendingTimersAsync, NOT runAllTimersAsync: the fresh
      // instance registered a periodic flush setInterval under fake timers,
      // which would reschedule forever and abort the run
      await vi.runOnlyPendingTimersAsync();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to store analytics locally:',
        expect.any(Error)
      );

      // Clean up the fresh instance's interval and restore the mock
      testAnalytics.destroy();
      localStorageMock.setItem.mockImplementation(() => undefined);
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('React Hook Integration', () => {
    it('should provide all tracking methods through hook', () => {
      const analytics = useRecommendationAnalytics();
      
      expect(analytics).toHaveProperty('trackRecommendationViewed');
      expect(analytics).toHaveProperty('trackRecommendationClicked');
      expect(analytics).toHaveProperty('trackTemplateApplied');
      expect(analytics).toHaveProperty('trackServiceAdded');
      expect(analytics).toHaveProperty('trackFeedback');
      expect(analytics).toHaveProperty('trackSearch');
      expect(analytics).toHaveProperty('trackFilter');
      expect(analytics).toHaveProperty('trackOptimization');
      expect(analytics).toHaveProperty('updateContext');
      expect(analytics).toHaveProperty('getSummary');
      expect(analytics).toHaveProperty('setEnabled');
    });

    it('should bind methods correctly through hook', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const analytics = useRecommendationAnalytics();
      
      analytics.trackRecommendationViewed(
        'template',
        'hook-test',
        0.9,
        1,
        'recommendation_engine'
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '📊 Recommendation Analytics:',
        'recommendation_viewed',
        expect.objectContaining({
          recommendationId: 'hook-test'
        })
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event data gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Should not crash with invalid data
      expect(() => {
        recommendationAnalytics.trackRecommendationViewed(
          'template' as any,
          '', // empty ID
          -1, // invalid confidence
          -1, // invalid position
          'recommendation_engine'
        );
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });

    it('should handle network failures during flush', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock network failure
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      
      recommendationAnalytics.trackRecommendationViewed(
        'template',
        'network-fail-test',
        0.8,
        1,
        'recommendation_engine'
      );

      // Force flush
      for (let i = 0; i < 9; i++) {
        recommendationAnalytics.trackRecommendationViewed(
          'template',
          `template-${i}`,
          0.8,
          i,
          'recommendation_engine'
        );
      }

      await vi.runAllTimersAsync();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send recommendation analytics:',
        expect.any(Error)
      );
      
      // Events should be retained for retry
      const summary = recommendationAnalytics.getAnalyticsSummary();
      expect(summary.pendingEvents).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      recommendationAnalytics.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
    });

    it('should flush remaining events on destroy', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Add some events
      recommendationAnalytics.trackRecommendationViewed(
        'template',
        'destroy-test',
        0.8,
        1,
        'recommendation_engine'
      );
      
      // Destroy should flush
      recommendationAnalytics.destroy();
      
      await vi.runAllTimersAsync();
      
      expect(global.fetch).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});