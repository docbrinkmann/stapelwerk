import type { Metadata } from 'next';
import { Suspense } from 'react';
// import { headers } from 'next/headers'; // Reserved for future use
import { QueryClient, HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { appRouter } from '@/server/root';
import { createTRPCContext } from '@/server/trpc';
import { ServiceBrowserClient } from './components/ServiceBrowserClient';
import { ServiceGridSkeleton } from '@/components/ServiceGridSkeleton';
import { getT } from '@/lib/i18n/server';
import './services.css';

// Page metadata
export const metadata: Metadata = {
  title: 'Services - Stapelwerk',
  description: 'Discover and explore container services for your self-hosted stack. Browse through curated Docker services with instant search, filtering, and stack integration.',
  keywords: ['docker services', 'container services', 'self-hosted', 'home lab', 'docker compose', 'Stapelwerk'],
  openGraph: {
    title: 'Services - Stapelwerk',
    description: 'Discover and explore container services for your self-hosted stack',
    type: 'website',
    url: '/services'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Services - Stapelwerk',
    description: 'Discover and explore container services for your self-hosted stack'
  }
};

// Server Component for initial data loading
async function ServicesServerComponent() {
  const queryClient = new QueryClient();
  
  try {
    console.log('Server: Starting data prefetch...');
    
    // Create server-side tRPC context
    const ctx = await createTRPCContext({ req: undefined });
    const caller = appRouter.createCaller(ctx);

    // Pre-fetch initial services with error handling
    try {
      await queryClient.prefetchInfiniteQuery({
        queryKey: ['services', 'list'],
        queryFn: async ({ pageParam = undefined }) => {
          const result = await caller.services.list({
            limit: 24,
            cursor: pageParam,
            search: undefined,
            featuredOnly: false
          });
          return result;
        },
        initialPageParam: undefined,
        staleTime: 5 * 60 * 1000, // 5 minutes
        getNextPageParam: (lastPage: any) => lastPage.nextCursor ?? undefined
      });
      console.log('Server: Services prefetch completed');
    } catch (servicesError) {
      console.warn('Server: Services prefetch failed, client will handle:', servicesError instanceof Error ? servicesError.message : String(servicesError));
    }

    // Pre-fetch categories with error handling  
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
      console.log('Server: Categories prefetch completed');
    } catch (categoriesError) {
      console.warn('Server: Categories prefetch failed, client will handle:', categoriesError instanceof Error ? categoriesError.message : String(categoriesError));
    }
    
    console.log('Server: Data prefetch completed successfully');

  } catch (error) {
    // Log error but don't throw - let client handle the error state
    console.error('Server: Failed to pre-fetch services data:', error instanceof Error ? error.message : error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ServiceBrowserClient />
    </HydrationBoundary>
  );
}

// Main Services Page Component
export default async function ServicesPage() {
  const t = await getT();
  return (
    <section className="services-page" aria-labelledby="services-title">
      {/* Page Header */}
      <header className="services-header">
        <div className="services-header__container">
          <div className="services-header__content">
            <h1 className="services-header__title">
              {t('catalog.browseTitle')}
            </h1>
            <p className="services-header__subtitle">
              {t('catalog.browseSubtitle')}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="services-content">
        <div className="services-content__container">
          <Suspense fallback={
            <div className="services-loading">
              <div className="search-bar-skeleton">
                <div className="search-bar-skeleton__input" />
                <div className="search-bar-skeleton__button" />
              </div>
              <ServiceGridSkeleton />
            </div>
          }>
            <ServicesServerComponent />
          </Suspense>
        </div>
      </div>

    </section>
  );
}

// Note: ErrorBoundary, Loading, and NotFound are handled by Next.js app router
// These would be implemented as separate error.tsx, loading.tsx, and not-found.tsx files
// in the same directory if needed
