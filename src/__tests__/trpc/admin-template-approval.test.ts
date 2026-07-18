import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createTRPCContext } from '@/server/trpc';
import { appRouter } from '@/server/root';
import { cleanupTestData } from '../helpers/test-data-factory';

// Shared in-memory client (same instance the routers use)
const prisma: any = new PrismaClient();

const cleanupStackData = async () => {
  await prisma.stack_service_configurations.deleteMany({});
  await prisma.stack_services.deleteMany({});
  await prisma.stacks.deleteMany({});
};

// The in-memory harness doesn't emulate Prisma `include`; attach the nested
// stack_services relation for findUnique (mirrors the stacks router test setup).
const rawStacksFindUnique = prisma.stacks.findUnique.bind(prisma.stacks);
prisma.stacks.findUnique = async (args: any = {}) => {
  const stack = await rawStacksFindUnique(args);
  if (!stack || !args?.include?.stack_services) return stack;
  const stackServiceRows = (await prisma.stack_services.findMany({ where: { stackId: stack.id } }))
    .sort((a: any, b: any) => a.order - b.order);
  const stack_services = [];
  for (const ss of stackServiceRows) {
    const services = await prisma.services.findUnique({ where: { id: ss.serviceId } });
    stack_services.push({ ...ss, services });
  }
  return { ...stack, stack_services };
};

// A normal authenticated caller (owns/creates stacks).
const createUserCaller = async (userId: string) => {
  const ctx = await createTRPCContext({ userId, req: {} as any, res: {} as any });
  return appRouter.createCaller(ctx);
};

// An admin caller: admin procedures gate on ctx.user.role === 'admin'.
const createAdminCaller = async (userId = 'admin-1') => {
  const ctx = await createTRPCContext({
    user: { id: userId, role: 'admin' },
    req: {} as any,
    res: {} as any,
  });
  return appRouter.createCaller(ctx);
};

describe('admin template approval (stack-based proposals)', () => {
  beforeEach(async () => {
    await cleanupTestData();
    await cleanupStackData();
  });

  afterEach(async () => {
    await cleanupTestData();
    await cleanupStackData();
  });

  const submitPendingStack = async (userId: string, name: string) => {
    const user = await createUserCaller(userId);
    const stack = await user.stacks.create({ name, description: `${name} description`, status: 'private' });
    await user.stacks.submitForApproval({ id: stack.id });
    return stack;
  };

  it('persists the submission description onto the stack', async () => {
    const user = await createUserCaller('user-1');
    const stack = await user.stacks.create({ name: 'Descriptionless', status: 'private' });

    // The submit modal collects a mandatory >=100-char description — it must
    // not be thrown away (the marketplace card renders stack.description).
    await user.stacks.submitForApproval({
      id: stack.id,
      description: 'A curated Nextcloud + PostgreSQL stack for private file sync.',
    });

    const updated = await prisma.stacks.findUnique({ where: { id: stack.id } });
    expect(updated.status).toBe('pending_approval');
    expect(updated.description).toBe(
      'A curated Nextcloud + PostgreSQL stack for private file sync.',
    );
  });

  it('lists a submitted stack in the admin pending queue', async () => {
    const stack = await submitPendingStack('user-1', 'Observability Stack');

    const admin = await createAdminCaller();
    const result = await admin.admin.getPendingTemplates({ page: 1, limit: 20 });

    const match = result.templates.find((t) => t.id === stack.id);
    expect(match).toBeTruthy();
    expect(match?.title).toBe('Observability Stack');
    expect(match?.status).toBe('pending');
    expect(match?.author.id).toBe('user-1');
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('approve publishes the stack so it appears in public templates and leaves the queue', async () => {
    const stack = await submitPendingStack('user-1', 'Approvable Stack');
    const admin = await createAdminCaller();

    const res = await admin.admin.reviewTemplate({ stackId: stack.id, action: 'approve' });
    expect(res.success).toBe(true);
    expect(res.status).toBe('public');

    // No longer pending
    const pending = await admin.admin.getPendingTemplates({ page: 1, limit: 20 });
    expect(pending.templates.find((t) => t.id === stack.id)).toBeUndefined();

    // Now a public template (what community/getPublicTemplates surface)
    const publicCaller = await createUserCaller('user-2');
    const publicTemplates = await publicCaller.stacks.getPublicTemplates({ limit: 20 });
    const published = publicTemplates.stacks.find((s: any) => s.id === stack.id);
    expect(published).toBeTruthy();
    expect(published.isTemplate).toBe(true);
    expect(published.status).toBe('public');
  });

  it('reject marks the stack rejected and out of the queue and public list', async () => {
    const stack = await submitPendingStack('user-1', 'Rejectable Stack');
    const admin = await createAdminCaller();

    const res = await admin.admin.reviewTemplate({
      stackId: stack.id,
      action: 'reject',
      reviewNotes: 'Needs more services',
    });
    expect(res.success).toBe(true);
    // 'rejected' (not 'private') so the author sees the outcome and the
    // rejected count in getTemplateApprovalStats is real.
    expect(res.status).toBe('rejected');

    const pending = await admin.admin.getPendingTemplates({ page: 1, limit: 20 });
    expect(pending.templates.find((t) => t.id === stack.id)).toBeUndefined();

    const publicCaller = await createUserCaller('user-2');
    const publicTemplates = await publicCaller.stacks.getPublicTemplates({ limit: 20 });
    expect(publicTemplates.stacks.find((s: any) => s.id === stack.id)).toBeUndefined();
  });

  it('reviewTemplate rejects a stack that is not pending approval', async () => {
    const user = await createUserCaller('user-1');
    const stack = await user.stacks.create({ name: 'Draft Only', status: 'draft' });
    const admin = await createAdminCaller();

    await expect(
      admin.admin.reviewTemplate({ stackId: stack.id, action: 'approve' })
    ).rejects.toThrow('Stack is not pending approval');
  });

  it('requires admin privileges for the pending queue and review', async () => {
    const stack = await submitPendingStack('user-1', 'Guarded Stack');
    const nonAdmin = await createUserCaller('user-1');

    await expect(
      nonAdmin.admin.getPendingTemplates({ page: 1, limit: 20 })
    ).rejects.toThrow('Admin access required');

    await expect(
      nonAdmin.admin.reviewTemplate({ stackId: stack.id, action: 'approve' })
    ).rejects.toThrow('Admin access required');
  });
});
