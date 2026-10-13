import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const getServerSession = vi.fn()
vi.mock('next-auth/next', () => ({ getServerSession: (...a: unknown[]) => getServerSession(...a) }))
const feedbackCreate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: { recommendation_feedback: { create: (...a: unknown[]) => feedbackCreate(...a) } },
}))

import { POST } from '../route'

const req = (events: unknown[]) =>
  new NextRequest('http://localhost/api/analytics/recommendations', { method: 'POST', body: JSON.stringify({ events }) })
const feedback = {
  sessionId: 's1',
  timestamp: new Date().toISOString(),
  eventType: 'feedback_provided',
  data: { recommendationId: 'r1', feedbackType: 'liked' },
  userId: 'victim', // forged — must never be trusted
}

describe('POST /api/analytics/recommendations (public app)', () => {
  beforeEach(() => feedbackCreate.mockReset().mockResolvedValue({}))

  it('anonymous: accepted so the client does not retry, but nothing is written', async () => {
    getServerSession.mockResolvedValue(null)
    const res = await POST(req([feedback]))
    expect(await res.json()).toMatchObject({ success: true, processed: 0 })
    expect(feedbackCreate).not.toHaveBeenCalled()
  })

  it('signed in: feedback is attributed to the session user, not the body', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'me' } })
    await POST(req([feedback]))
    expect(feedbackCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'me' }) }),
    )
  })
})
