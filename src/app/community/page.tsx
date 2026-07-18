import type { Metadata } from 'next';
import { Suspense } from 'react';
import CommunityMarketplace from './components/CommunityMarketplace';
import CommunityMarketplaceSkeleton from './components/CommunityMarketplaceSkeleton';
import { trpc } from '@/lib/trpc/server';

// Force dynamic rendering (no static generation at build time)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Community Stack Marketplace | Build My Stack',
  description: 'Discover, share, and import community-created infrastructure stacks. Find the perfect stack configuration for your project.',
  keywords: [
    'docker stacks',
    'community templates',
    'infrastructure sharing',
    'microservices',
    'containerization',
    'devops templates'
  ].join(', '),
  openGraph: {
    title: 'Community Stack Marketplace',
    description: 'Discover and share infrastructure stacks with the community',
    type: 'website',
    images: [
      {
        url: '/api/og/community',
        width: 1200,
        height: 630,
        alt: 'Community Stack Marketplace'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Stack Marketplace',
    description: 'Discover and share infrastructure stacks with the community',
    images: ['/api/og/community']
  }
};

export default async function CommunityMarketplacePage() {
  try {
    // Prefetch community data
    const [
      featuredStacks,
      popularStacks,
      categories,
      marketplaceStats
    ] = await Promise.all([
      trpc.community.getFeaturedStacks({ limit: 6 }),
      trpc.community.getPopularStacks({ limit: 12 }),
      trpc.community.getCategories(),
      trpc.community.getMarketplaceStats()
    ]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <Suspense fallback={<CommunityMarketplaceSkeleton />}>
          <CommunityMarketplace
            initialFeatured={featuredStacks as any}
            initialPopular={popularStacks as any}
            categories={categories}
            marketplaceStats={marketplaceStats}
          />
        </Suspense>
      </div>
    );
  } catch (error) {
    // Fallback to loading state on server error
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <CommunityMarketplaceSkeleton />
      </div>
    );
  }
}