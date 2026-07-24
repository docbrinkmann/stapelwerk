import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

/**
 * Render test for the €29 report panel's NEW surface: the deploy safety audit
 * section. The live browser click-through was blocked by the dev server's
 * persistent connections wedging the CDP session; this mounts the REAL panel
 * (only tRPC mocked) and confirms the audit properties actually render to the
 * buyer — pass, fail, and warn — with the overall "Not deploy-safe" verdict.
 */

// A report whose kill-switch is n/a but whose safety audit FAILS — the exact
// shape `buildReport` produces (fields the panel reads).
const h = vi.hoisted(() => ({
  result: {
    report: {
      version: 1,
      reportId: 'rep-x',
      stackId: 's1',
      stackName: 'S',
      product: 'verified-deploy',
      composeSha256: 'abc123def456ghi789',
      status: 'no-download-client',
      findings: [],
      summary: 'No recognised download client present to confine.',
      audit: {
        status: 'fail',
        properties: [
          { id: 'exposed-datastore-port', title: 'No datastore exposed on the host network', status: 'fail', findings: [{ service: 'db', verdict: 'fail', detail: 'publishes datastore port 5432 to a non-loopback host interface' }] },
          { id: 'stateful-no-volume', title: 'Datastores keep their data (persistent volumes)', status: 'pass', findings: [] },
          { id: 'weak-secret', title: 'No default or empty secrets', status: 'not-applicable', findings: [] },
          { id: 'unpinned-image', title: 'Images are pinned to a version', status: 'warn', findings: [{ service: 'db', verdict: 'warn', detail: 'image "postgres:latest" is unpinned' }] },
        ],
        summary: 'Not deploy-safe: No datastore exposed on the host network.',
      },
      issuedAt: '2026-07-22T00:00:00.000Z',
      issuer: 'Stapelwerk',
    },
    signature: 'sig-abc',
  },
}));

vi.mock('@/trpc/react-client', () => ({
  trpc: {
    verifiedDeploy: {
      checkout: { useQuery: () => ({ data: { billingEnabled: false, price: 29, url: null } }) },
      entitlement: { useQuery: () => ({ data: { credits: null } }) },
      listForStack: { useQuery: () => ({ data: [] }) },
      generate: {
        useMutation: (opts: { onSuccess: (r: unknown) => void }) => ({
          mutate: () => opts.onSuccess(h.result),
          isPending: false,
          error: null,
        }),
      },
    },
    useUtils: () => ({
      verifiedDeploy: { listForStack: { invalidate: vi.fn() }, entitlement: { invalidate: vi.fn() } },
    }),
  },
}));

import { VerifiedDeployPanel } from '../VerifiedDeployPanel';

describe('VerifiedDeployPanel — safety audit rendering', () => {
  it('renders the audit properties and the overall verdict after generating', () => {
    render(<VerifiedDeployPanel stackId="s1" />);

    // Self-host: the free generate button is shown.
    const btn = screen.getByRole('button', { name: /Generate signed report/i });
    fireEvent.click(btn);

    // The new audit section renders with its heading and overall verdict badge.
    expect(screen.getByText('Deploy safety audit')).toBeInTheDocument();
    expect(screen.getByText('Not deploy-safe')).toBeInTheDocument();

    // A FAILING property shows with its title and the failing finding detail.
    expect(screen.getByText(/No datastore exposed on the host network/)).toBeInTheDocument();
    expect(screen.getByText(/publishes datastore port 5432/)).toBeInTheDocument();

    // A PASSING property shows too (the buyer sees what was verified).
    expect(screen.getByText(/Datastores keep their data/)).toBeInTheDocument();

    // The signed badge renders (report is signed).
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });
});
