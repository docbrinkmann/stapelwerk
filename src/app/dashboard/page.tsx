import type { Metadata } from 'next';
import { Suspense } from 'react';
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { appRouter } from '@/server/root';
import { createTRPCContext } from '@/server/trpc';
import { DashboardClient } from './components/DashboardClient';
import { DashboardSkeleton } from './components/DashboardSkeleton';
import { StatsCardsLive, RecentActivityLive, QuickActions } from '@/components/dashboard';
import './dashboard.css';

// Page metadata
export const metadata: Metadata = {
  title: 'Dashboard - BuildMyStack',
  description: 'Manage your personal stacks, monitor deployments, and track your self-hosted infrastructure. Your central hub for stack management.',
  keywords: ['stack management', 'dashboard', 'infrastructure', 'docker stacks', 'deployment monitoring', 'BuildMyStack'],
  openGraph: {
    title: 'Dashboard - BuildMyStack',
    description: 'Manage your personal stacks and monitor your self-hosted infrastructure',
    type: 'website',
    url: '/dashboard'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dashboard - BuildMyStack',
    description: 'Your central hub for stack management and infrastructure monitoring'
  }
};

// Server Component for initial data loading
async function DashboardServerComponent() {
  const queryClient = new QueryClient();
  
  try {
    console.log('Dashboard Server: Starting data prefetch...');
    
    // Create server-side tRPC context
    const ctx = await createTRPCContext({ req: undefined });
    const caller = appRouter.createCaller(ctx);

    // Pre-fetch user's stacks from database
    try {
      await queryClient.prefetchQuery({
        queryKey: ['stacks', 'list'],
        queryFn: async () => {
          const result = await caller.stacks.list({
            limit: 50 // Get all user stacks for dashboard
          });
          return result;
        },
        staleTime: 2 * 60 * 1000 // 2 minutes
      });
      console.log('Dashboard Server: User stacks prefetch completed');
    } catch (stacksError) {
      console.warn('Dashboard Server: User stacks prefetch failed, client will handle:', stacksError instanceof Error ? stacksError.message : String(stacksError));
    }

    // Pre-fetch stack statistics and analytics
    try {
      await queryClient.prefetchQuery({
        queryKey: ['analytics', 'dashboard'],
        queryFn: async () => {
          const result = await caller.analytics.getAnalytics();
          return result;
        },
        staleTime: 5 * 60 * 1000 // 5 minutes
      });
      console.log('Dashboard Server: Analytics prefetch completed');
    } catch (analyticsError) {
      console.warn('Dashboard Server: Analytics prefetch failed, client will handle:', analyticsError instanceof Error ? analyticsError.message : String(analyticsError));
    }

    // Pre-fetch recent activity/logs
    try {
      await queryClient.prefetchQuery({
        queryKey: ['analytics', 'activity', 'recent'],
        queryFn: async () => {
          const result = await caller.analytics.getRecentActivity({ limit: 20 });
          return result;
        },
        staleTime: 1 * 60 * 1000 // 1 minute
      });
      console.log('Dashboard Server: Recent activity prefetch completed');
    } catch (activityError) {
      console.warn('Dashboard Server: Recent activity prefetch failed, client will handle:', activityError instanceof Error ? activityError.message : String(activityError));
    }
    
    console.log('Dashboard Server: Data prefetch completed successfully');

  } catch (error) {
    // Log error but don't throw - let client handle the error state
    console.error('Dashboard Server: Failed to pre-fetch data:', error instanceof Error ? error.message : error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}

// Main Dashboard Page Component
export default function DashboardPage() {
  return (
    <section className="space-y-6" aria-labelledby="dashboard-title">
      {/* Page Header */}
      <div>
        <h1 id="dashboard-title" className="text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage your stacks, monitor deployments, and track your infrastructure
        </p>
      </div>

      {/* Stats Overview (live analytics data) */}
      <StatsCardsLive />

      {/* Quick Actions and Recent Activity.
          ResourceMonitor intentionally removed: BuildMyStack is a stack
          builder, not a hosting platform — fake host metrics were misleading. */}
      <div className="grid gap-6 md:grid-cols-2">
        <QuickActions />
        <RecentActivityLive />
      </div>

      {/* Legacy Dashboard Content */}
      <div className="dashboard-content">
        <div className="dashboard-content__container">
          <Suspense fallback={
            <div className="dashboard-loading">
              <DashboardSkeleton />
            </div>
          }>
            <DashboardServerComponent />
          </Suspense>
        </div>
      </div>

      {/* Performance Monitoring */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Basic performance monitoring for Core Web Vitals
            if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
              const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                  // Log performance metrics (could be sent to analytics)
                  console.debug('Dashboard Performance metric:', entry.name, entry.value);
                }
              });
              observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
            }
          `
        }}
      />
    </section>
  );
}

// Note: ErrorBoundary, Loading, and NotFound are handled by Next.js app router
// These would be implemented as separate error.tsx, loading.tsx, and not-found.tsx files
// in the same directory if needed