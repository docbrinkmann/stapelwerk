import type { Metadata } from 'next';
import { Suspense } from 'react';
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { appRouter } from '@/server/root';
import { createTRPCContext } from '@/server/trpc';
import { getT } from '@/lib/i18n/server';
import { StackBuilderClient } from './components/StackBuilderClient';
import { StackBuilderSkeleton } from './components/StackBuilderSkeleton';
import './stack-builder.css';

// Page metadata
export const metadata: Metadata = {
  title: 'Stack Builder - Stapelwerk',
  description: 'Build and configure your perfect self-hosted stack with our interactive drag-and-drop interface. Add services, configure settings, and export Docker Compose files.',
  keywords: ['stack builder', 'docker compose', 'self-hosted stack', 'container orchestration', 'service configuration', 'Stapelwerk'],
  openGraph: {
    title: 'Stack Builder - Stapelwerk',
    description: 'Build and configure your perfect self-hosted stack with our interactive interface',
    type: 'website',
    url: '/stack-builder'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stack Builder - Stapelwerk',
    description: 'Build and configure your perfect self-hosted stack with our interactive interface'
  }
};

// Server Component for initial data loading
async function StackBuilderServerComponent() {
  const queryClient = new QueryClient();
  
  try {
    console.log('StackBuilder Server: Starting data prefetch...');
    
    // Create server-side tRPC context
    const ctx = await createTRPCContext({ req: undefined });
    const caller = appRouter.createCaller(ctx);

    // Pre-fetch popular/featured services for the service panel
    try {
      await queryClient.prefetchInfiniteQuery({
        queryKey: ['services', 'list'],
        queryFn: async ({ pageParam = undefined }) => {
          const result = await caller.services.list({
            limit: 24,
            cursor: pageParam,
            search: undefined,
            featuredOnly: true // Get featured services for stack builder
          });
          return result;
        },
        initialPageParam: undefined,
        staleTime: 5 * 60 * 1000, // 5 minutes
        getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? undefined
      });
      console.log('StackBuilder Server: Featured services prefetch completed');
    } catch (servicesError) {
      console.warn('StackBuilder Server: Featured services prefetch failed, client will handle:', servicesError instanceof Error ? servicesError.message : String(servicesError));
    }

    // Pre-fetch categories for filtering
    try {
      await queryClient.prefetchQuery({
        queryKey: ['categories'],
        queryFn: async () => {
          const result = await caller.categories.list({
            limit: 50,
            withServiceCount: true
          });
          return result;
        },
        staleTime: 15 * 60 * 1000 // 15 minutes
      });
      console.log('StackBuilder Server: Categories prefetch completed');
    } catch (categoriesError) {
      console.warn('StackBuilder Server: Categories prefetch failed, client will handle:', categoriesError instanceof Error ? categoriesError.message : String(categoriesError));
    }

    // Pre-fetch user's existing stacks if available
    try {
      await queryClient.prefetchQuery({
        queryKey: ['stacks', 'list'],
        queryFn: async () => {
          const result = await caller.stacks.list({
            limit: 10
          });
          return result;
        },
        staleTime: 2 * 60 * 1000 // 2 minutes
      });
      console.log('StackBuilder Server: User stacks prefetch completed');
    } catch (stacksError) {
      console.warn('StackBuilder Server: User stacks prefetch failed, client will handle:', stacksError instanceof Error ? stacksError.message : String(stacksError));
    }
    
    console.log('StackBuilder Server: Data prefetch completed successfully');

  } catch (error) {
    // Log error but don't throw - let client handle the error state
    console.error('StackBuilder Server: Failed to pre-fetch data:', error instanceof Error ? error.message : error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StackBuilderClient />
    </HydrationBoundary>
  );
}

// Main Stack Builder Page Component
export default async function StackBuilderPage() {
  const t = await getT();
  return (
    <section className="stack-builder-page" aria-labelledby="stack-builder-title">
      {/* Page Header */}
      <header className="stack-builder-header">
        <div className="stack-builder-header__container">
          <div className="stack-builder-header__content">
            <h1 className="stack-builder-header__title">
              {t('builder.pageTitle')}
            </h1>
            <p className="stack-builder-header__subtitle">
              {t('builder.pageSubtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="stack-builder-content">
        <div className="stack-builder-content__container">
          <Suspense fallback={
            <div className="stack-builder-loading">
              <StackBuilderSkeleton />
            </div>
          }>
            <StackBuilderServerComponent />
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
                  console.debug('StackBuilder Performance metric:', entry.name, entry.value);
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