/**
 * WebSocket API Route
 * 
 * This route provides WebSocket server information and health checks.
 * 
 * Note: Next.js App Router doesn't natively support WebSocket upgrades in API routes.
 * For WebSocket connections, use the custom server setup or connect to the WebSocket
 * server port directly.
 * 
 * WebSocket URL: ws://localhost:3001/ws (when using custom server)
 */

import { NextResponse } from 'next/server';
import { getServerStats } from '@/server/ws';

/**
 * GET /api/ws
 * Returns WebSocket server information and statistics
 */
export async function GET() {
  try {
    const stats = getServerStats();
    
    return NextResponse.json({
      status: 'available',
      wsUrl: process.env.WS_URL ?? 'ws://localhost:3001/ws',
      endpoints: {
        logs: '/ws - Subscribe to log streams',
        terminal: '/ws - Interactive terminal sessions',
        status: '/ws - Real-time status updates',
      },
      stats,
      protocols: ['logs', 'terminal', 'status'],
      version: '1.0.0',
    });
  } catch (error) {
    console.error('[WS] Error getting server stats:', error);
    
    return NextResponse.json({
      status: 'unavailable',
      wsUrl: process.env.WS_URL ?? 'ws://localhost:3001/ws',
      error: 'WebSocket server not initialized',
    }, { status: 503 });
  }
}

/**
 * POST /api/ws
 * Used for testing WebSocket message handling via HTTP
 * (Useful for debugging or when WebSocket is unavailable)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate message structure
    if (!body.type) {
      return NextResponse.json(
        { error: 'Missing message type' },
        { status: 400 }
      );
    }
    
    // For now, just echo back the message structure
    // In production, this could be used for HTTP fallback
    return NextResponse.json({
      received: true,
      message: body,
      note: 'Use WebSocket connection for real-time features',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
