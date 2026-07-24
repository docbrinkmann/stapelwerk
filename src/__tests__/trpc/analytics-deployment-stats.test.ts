import { describe, it, expect } from 'vitest';
import { bucketDeploymentStats } from '@/server/routers/analytics';

// Regression: deployment_jobs write status 'succeeded'/'queued', but the
// dashboard analytics bucketed only 'completed'/'pending' — the UI showed
// "19 total, 0 completed" over a history full of successful deploys.
describe('bucketDeploymentStats', () => {
  it('maps real job statuses (succeeded/queued) into the UI buckets', () => {
    const stats = bucketDeploymentStats([
      { status: 'succeeded', _count: { status: 8 } },
      { status: 'failed', _count: { status: 7 } },
      { status: 'queued', _count: { status: 4 } },
    ]);
    expect(stats).toEqual({ total: 19, running: 0, completed: 8, failed: 7, pending: 4 });
  });

  it('still counts legacy/alternate labels and running jobs', () => {
    const stats = bucketDeploymentStats([
      { status: 'completed', _count: { status: 2 } },
      { status: 'pending', _count: { status: 1 } },
      { status: 'running', _count: { status: 3 } },
    ]);
    expect(stats).toEqual({ total: 6, running: 3, completed: 2, failed: 0, pending: 1 });
  });

  it('ignores unknown statuses in buckets but counts them in total', () => {
    const stats = bucketDeploymentStats([{ status: 'canceled', _count: { status: 5 } }]);
    expect(stats).toEqual({ total: 5, running: 0, completed: 0, failed: 0, pending: 0 });
  });
});
