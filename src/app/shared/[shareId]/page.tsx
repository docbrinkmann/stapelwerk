import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SharedStackViewer from './components/SharedStackViewer';
import { trpc } from '@/lib/trpc/server';
import { getT } from '@/lib/i18n/server';

interface SharedStackPageProps {
  params: Promise<{
    shareId: string;
  }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
}

// Generate metadata for shared stack pages
export async function generateMetadata({ 
  params 
}: SharedStackPageProps): Promise<Metadata> {
  const { shareId } = await params
  const t = await getT()
  try {
    // Fetch stack metadata for SEO
    const sharedStack = await trpc.stacks.getSharedStack({ shareId });
    
    return {
      title: t('catalog.sharedMetaTitle', { name: sharedStack.name }),
      description: sharedStack.description || t('catalog.sharedMetaDescription', { name: sharedStack.name }),
      openGraph: {
        title: sharedStack.name,
        description: sharedStack.description || t('catalog.sharedOgDescription', { count: sharedStack.services.length }),
        type: 'website',
        images: [
          {
            url: `/api/og/stack/${shareId}`,
            width: 1200,
            height: 630,
            alt: t('catalog.sharedImageAlt', { name: sharedStack.name })
          }
        ]
      },
      twitter: {
        card: 'summary_large_image',
        title: sharedStack.name,
        description: sharedStack.description || t('catalog.sharedOgDescription', { count: sharedStack.services.length }),
        images: [`/api/og/stack/${shareId}`]
      },
      keywords: [
        'docker',
        'stack',
        'microservices',
        'container',
        'infrastructure',
        ...sharedStack.tags || []
      ].join(', ')
    };
  } catch (error) {
    return {
      title: t('catalog.sharedNotFoundTitle'),
      description: t('catalog.sharedNotFoundDescription')
    };
  }
}

export default async function SharedStackPage({ 
  params, 
  searchParams 
}: SharedStackPageProps) {
  const { shareId } = await params
  try {
    // Fetch shared stack data server-side
    const sharedStack = await trpc.stacks.getSharedStack({ 
      shareId 
    });
    
    // Get related stacks by same author or similar tags
    const relatedStacks = await trpc.stacks.getRelatedStacks({
      stackId: sharedStack.id,
      limit: 6
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <SharedStackViewer
          sharedStack={sharedStack}
          relatedStacks={relatedStacks as unknown as any}
          shareId={shareId}
        />
      </div>
    );
  } catch (error) {
    // Stack not found or access denied
    notFound();
  }
}