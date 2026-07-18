import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SharedStackViewer from './components/SharedStackViewer';
import { trpc } from '@/lib/trpc/server';

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
  try {
    // Fetch stack metadata for SEO
    const sharedStack = await trpc.stacks.getSharedStack({ shareId });
    
    return {
      title: `${sharedStack.name} | Shared Stack`,
      description: sharedStack.description || `Explore the ${sharedStack.name} stack configuration`,
      openGraph: {
        title: sharedStack.name,
        description: sharedStack.description || `A shared stack configuration with ${sharedStack.services.length} services`,
        type: 'website',
        images: [
          {
            url: `/api/og/stack/${shareId}`,
            width: 1200,
            height: 630,
            alt: `${sharedStack.name} stack preview`
          }
        ]
      },
      twitter: {
        card: 'summary_large_image',
        title: sharedStack.name,
        description: sharedStack.description || `A shared stack configuration with ${sharedStack.services.length} services`,
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
      title: 'Shared Stack Not Found',
      description: 'The requested shared stack could not be found.'
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