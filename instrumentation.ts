/**
 * OpenTelemetry Instrumentation
 *
 * This file is automatically loaded by Next.js when the application starts.
 * It sets up distributed tracing, metrics, and logging for the Stapelwerk application.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @see https://vercel.com/docs/observability/otel-overview
 */

import { registerOTel } from '@vercel/otel';

/**
 * Register OpenTelemetry instrumentation
 * This function is called once when the Next.js application starts
 */
export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Register OpenTelemetry with Vercel's configuration
    registerOTel({
      serviceName: 'stapelwerk',
    });

    // Import and register Prisma instrumentation
    await registerPrismaInstrumentation();
  }
}

/**
 * Register Prisma instrumentation for database query tracing
 */
async function registerPrismaInstrumentation() {
  try {
    const { registerInstrumentations } = await import('@opentelemetry/instrumentation');
    const { PrismaInstrumentation } = await import('@prisma/instrumentation');

    registerInstrumentations({
      instrumentations: [
        new PrismaInstrumentation(),
      ],
    });

    if (process.env.NEXT_OTEL_VERBOSE === '1') {
      console.log('[OpenTelemetry] Prisma instrumentation registered successfully');
    }
  } catch (error) {
    console.error('[OpenTelemetry] Failed to register Prisma instrumentation:', error);
  }
}
