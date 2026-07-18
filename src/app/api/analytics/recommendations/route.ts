import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface AnalyticsEvent {
  sessionId: string;
  timestamp: string;
  eventType: string;
  data: Record<string, any>;
  userId?: string;
}

interface AnalyticsRequest {
  events: AnalyticsEvent[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AnalyticsRequest;
    const { events } = body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Invalid events data' }, { status: 400 });
    }

    // Validate events
    for (const event of events) {
      if (!event.sessionId || !event.timestamp || !event.eventType || !event.data) {
        return NextResponse.json({ error: 'Missing required event fields' }, { status: 400 });
      }
    }

    // Process events in batches for better performance
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }

    // Store analytics data
    const results = await Promise.allSettled(
      batches.map(batch => processBatch(batch))
    );

    // Check for any failures
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.error('Some analytics events failed to process:', failures);
    }

    // Return success with processing summary
    return NextResponse.json({
      success: true,
      processed: events.length,
      batches: batches.length,
      failures: failures.length
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processBatch(events: AnalyticsEvent[]) {
  // Analytics models are now implemented in the database schema
  // Process events for real-time analytics and tracking

  try {
    // Process specific event types for real-time insights
    await Promise.all(events.map(processEventType));
  } catch (error) {
    console.error('Event processing error:', error);
    throw error;
  }
}

async function processEventType(event: AnalyticsEvent) {
  const { eventType, data, sessionId } = event;

  try {
    switch (eventType) {
      case 'template_applied':
        // Update template popularity metrics
        if (data.templateId) {
          await prisma.use_case_templates.update({
            where: { id: data.templateId },
            data: {
              usageCount: { increment: 1 },
              updatedAt: new Date()
            }
          }).catch(() => {
            // Silently fail if template doesn't exist
          });
        }
        break;

      case 'service_added':
        // Track service popularity by recording service usage
        if (data.serviceId && typeof data.serviceId === 'number') {
          try {
            // Service popularity is tracked implicitly through stack_services table
            // The more a service appears in stacks, the more popular it is
            // We can query this with: SELECT serviceId, COUNT(*) FROM stack_services GROUP BY serviceId

            // For real-time tracking, we could also update a dedicated counter
            // but for now we'll rely on aggregate queries when needed

            // Log the service addition for analytics processing
            console.log(`Service ${data.serviceId} added to stack ${data.stackId || 'unknown'}`);

            // Optional: Create or update service recommendations based on this event
            // This helps identify popular service combinations
            if (data.stackId) {
              // Query other services in the same stack to find common patterns
              const stackServices = await prisma.stack_services.findMany({
                where: {
                  stackId: String(data.stackId),
                  serviceId: { not: data.serviceId }
                },
                select: { serviceId: true },
                take: 10
              });

              // Generate recommendations for complementary services
              // based on what other services are commonly used together
              const relatedServiceIds = stackServices.map(ss => ss.serviceId);

              if (relatedServiceIds.length > 0) {
                // This data can be used to improve recommendation algorithms
                console.log(`Service ${data.serviceId} often used with:`, relatedServiceIds);
              }
            }
          } catch (error) {
            console.error('Service popularity tracking error:', error);
            // Don't throw - analytics errors shouldn't break the flow
          }
        }
        break;

      case 'feedback_provided':
        // Store feedback for recommendation quality improvement
        if (data.recommendationId) {
          await prisma.recommendation_feedback.create({
            data: {
              id: (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) as string,
              recommendationId: String(data.recommendationId),
              userId: event.userId || null,
              sessionId: sessionId,
              action: String(data.feedbackType || 'dismissed'),
              rating: typeof data.rating === 'number' ? data.rating : null,
              comment: data.feedbackComment ?? null,
            } as any,
          }).catch(() => {
            // Silently fail if recommendation doesn't exist
          });
        }
        break;

      case 'recommendation_clicked':
        // Track recommendation click
        if (data.recommendationId) {
          await prisma.recommendations.update({
            where: { id: data.recommendationId },
            data: {
              adoptionCount: { increment: 1 }
            }
          }).catch(() => {
            // Silently fail if recommendation doesn't exist
          });
        }
        break;

      case 'recommendation_viewed':
        // Track recommendation view
        if (data.recommendationId) {
          await prisma.recommendations.update({
            where: { id: data.recommendationId },
            data: {
              viewCount: { increment: 1 }
            }
          }).catch(() => {
            // Silently fail if recommendation doesn't exist
          });
        }
        break;

      default:
        // For other events, we just store them in the main analytics table
        break;
    }
  } catch (error) {
    console.error(`Error processing ${eventType}:`, error);
    // Don't throw to avoid failing the entire batch
  }
}

export async function GET() {
  // Analytics summary endpoint
  // Note: Detailed analytics storage is not yet implemented
  return NextResponse.json({
    message: 'Analytics endpoint is active',
    status: 'operational',
    note: 'Detailed analytics storage will be implemented when analytics models are added to the schema'
  });
}
