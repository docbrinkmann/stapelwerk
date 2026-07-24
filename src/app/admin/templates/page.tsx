import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import TemplateApprovalSystem from './components/TemplateApprovalSystem';
import TemplateApprovalSkeleton from './components/TemplateApprovalSkeleton';
import { getPageSession } from '@/lib/auth';
import { trpc } from '@/lib/trpc/server';
import { getT } from '@/lib/i18n/server';

// Force dynamic rendering to avoid data fetching during build in CI
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Template Approval | Admin',
  description: 'Review and approve community template submissions',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TemplateApprovalPage() {
  // Check admin authentication
  const session = await getPageSession();
  // Auth sets `session.user.role` (from users.role) — there is no `isAdmin`, so
  // the old `!session.user.isAdmin` check 403'd EVERY user, admins included.
  // Mirror the server admin router, which gates on role === 'admin'.
  if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
    redirect('/403');
  }

  // Prefetch pending templates data
  const pendingTemplates = await trpc.admin.getPendingTemplates({
    page: 1,
    limit: 20
  });

  const approvalStats = await trpc.admin.getTemplateApprovalStats();

  const t = await getT();
  return (
    <div className="min-h-screen bg-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t('catalog.adminApprovalTitle')}</h1>
          <p className="mt-2 text-muted-foreground">
            {t('catalog.adminApprovalSubtitle')}
          </p>
        </div>

        <Suspense fallback={<TemplateApprovalSkeleton />}>
          <TemplateApprovalSystem 
            initialTemplates={pendingTemplates}
            initialStats={approvalStats}
          />
        </Suspense>
      </div>
    </div>
  );
}