/**
 * Mock WebSocket Server for Testing
 * Provides mock implementations for WebSocket functionality in collaboration tests
 */

import { vi } from 'vitest'
import { EventEmitter } from 'events'

export interface MockWebSocketConnection {
  id: string
  userId: string
  organizationId: string
  stackId: string
  emit: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  join: ReturnType<typeof vi.fn>
  leave: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  to: ReturnType<typeof vi.fn>
}

export interface MockWebSocketServer extends EventEmitter {
  connections: Map<string, MockWebSocketConnection>
  rooms: Map<string, Set<string>>
  connect: (connectionData: any) => MockWebSocketConnection
  disconnect: (connectionId: string) => void
  broadcast: ReturnType<typeof vi.fn>
  broadcastToRoom: ReturnType<typeof vi.fn>
  getConnectionsInRoom: (room: string) => MockWebSocketConnection[]
  close: () => void
}

export function createMockWebSocketServer(): MockWebSocketServer {
  const server = new EventEmitter() as MockWebSocketServer
  
  server.connections = new Map()
  server.rooms = new Map()

  server.connect = vi.fn().mockImplementation((connectionData: {
    userId: string
    organizationId: string
    stackId: string
  }) => {
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const roomId = `stack-${connectionData.stackId}`

    const mockConnection: MockWebSocketConnection = {
      id: connectionId,
      userId: connectionData.userId,
      organizationId: connectionData.organizationId,
      stackId: connectionData.stackId,

      emit: vi.fn().mockImplementation((event: string, data: any) => {
        // Simulate emitting events to the connection
        process.nextTick(() => {
          server.emit('connectionEmit', { connectionId, event, data })
        })
        return mockConnection
      }),

      on: vi.fn().mockImplementation((event: string, handler: (...args: any[]) => void) => {
        // Simulate event listener registration
        server.on(`${connectionId}:${event}`, handler)
        return mockConnection
      }),

      join: vi.fn().mockImplementation((room: string) => {
        if (!server.rooms.has(room)) {
          server.rooms.set(room, new Set())
        }
        server.rooms.get(room)!.add(connectionId)
        
        server.emit('userJoined', {
          room,
          connectionId,
          userId: connectionData.userId
        })
        
        return mockConnection
      }),

      leave: vi.fn().mockImplementation((room: string) => {
        if (server.rooms.has(room)) {
          server.rooms.get(room)!.delete(connectionId)
          if (server.rooms.get(room)!.size === 0) {
            server.rooms.delete(room)
          }
        }
        
        server.emit('userLeft', {
          room,
          connectionId,
          userId: connectionData.userId
        })
        
        return mockConnection
      }),

      disconnect: vi.fn().mockImplementation(() => {
        // Remove from all rooms
        for (const [room, connections] of server.rooms.entries()) {
          if (connections.has(connectionId)) {
            connections.delete(connectionId)
            if (connections.size === 0) {
              server.rooms.delete(room)
            }
          }
        }
        
        server.connections.delete(connectionId)
        server.emit('disconnected', { connectionId, userId: connectionData.userId })
        return mockConnection
      }),

      to: vi.fn().mockImplementation((room: string) => ({
        emit: vi.fn().mockImplementation((event: string, data: any) => {
          const connectionsInRoom = server.getConnectionsInRoom(room)
          connectionsInRoom.forEach(conn => {
            if (conn.id !== connectionId) { // Don't send to self
              conn.emit(event, data)
            }
          })
        })
      }))
    }

    // Auto-join the stack room
    mockConnection.join(roomId)
    server.connections.set(connectionId, mockConnection)
    
    server.emit('connected', { 
      connectionId, 
      userId: connectionData.userId,
      organizationId: connectionData.organizationId,
      stackId: connectionData.stackId
    })

    return mockConnection
  })

  server.disconnect = vi.fn().mockImplementation((connectionId: string) => {
    const connection = server.connections.get(connectionId)
    if (connection) {
      connection.disconnect()
    }
  })

  server.broadcast = vi.fn().mockImplementation((event: string, data: any) => {
    server.connections.forEach(connection => {
      connection.emit(event, data)
    })
  })

  server.broadcastToRoom = vi.fn().mockImplementation((room: string, event: string, data: any) => {
    const connectionsInRoom = server.getConnectionsInRoom(room)
    connectionsInRoom.forEach(connection => {
      connection.emit(event, data)
    })
  })

  server.getConnectionsInRoom = vi.fn().mockImplementation((room: string): MockWebSocketConnection[] => {
    const connectionIds = server.rooms.get(room) || new Set()
    const connections: MockWebSocketConnection[] = []
    
    connectionIds.forEach(connectionId => {
      const connection = server.connections.get(connectionId)
      if (connection) {
        connections.push(connection)
      }
    })
    
    return connections
  })

  server.close = vi.fn().mockImplementation(() => {
    // Disconnect all connections
    server.connections.forEach(connection => {
      connection.disconnect()
    })
    server.connections.clear()
    server.rooms.clear()
    server.removeAllListeners()
  })

  return server
}

/**
 * Create a mock WebSocket server with specific behaviors for testing
 */
export function createMockWebSocketServerWithBehaviors(behaviors: {
  shouldFailConnection?: boolean
  simulateNetworkDelay?: boolean
  maxConnections?: number
} = {}): MockWebSocketServer {
  const server = createMockWebSocketServer()

  if (behaviors.shouldFailConnection) {
    const originalConnect = server.connect
    server.connect = vi.fn().mockImplementation((connectionData) => {
      throw new Error('Connection failed')
    })
  }

  if (behaviors.simulateNetworkDelay) {
    const originalBroadcastToRoom = server.broadcastToRoom
    server.broadcastToRoom = vi.fn().mockImplementation((room: string, event: string, data: any) => {
      setTimeout(() => {
        originalBroadcastToRoom.call(server, room, event, data)
      }, 100) // 100ms delay
    })
  }

  if (behaviors.maxConnections) {
    const originalConnect = server.connect
    server.connect = vi.fn().mockImplementation((connectionData) => {
      if (server.connections.size >= behaviors.maxConnections!) {
        throw new Error('Maximum connections reached')
      }
      return originalConnect.call(server, connectionData)
    })
  }

  return server
}

/**
 * Helper to simulate WebSocket events for testing
 */
export function simulateWebSocketEvent(
  server: MockWebSocketServer,
  connectionId: string,
  event: string,
  data: any
) {
  const connection = server.connections.get(connectionId)
  if (connection) {
    // Emit the event as if it came from the connection
    server.emit(`${connectionId}:${event}`, data)
  }
}

/**
 * Helper to simulate multiple users collaborating
 */
export function simulateCollaborativeSession(
  server: MockWebSocketServer,
  stackId: string,
  users: Array<{ userId: string; organizationId: string }>
): MockWebSocketConnection[] {
  const connections = users.map(user => 
    server.connect({
      userId: user.userId,
      organizationId: user.organizationId,
      stackId
    })
  )

  // Simulate some collaborative events
  setTimeout(() => {
    // User presence updates
    connections.forEach((conn, index) => {
      simulateWebSocketEvent(server, conn.id, 'cursor_move', {
        userId: conn.userId,
        position: { x: 100 + index * 50, y: 200 + index * 30 },
        timestamp: Date.now()
      })
    })

    // Simulate an operation from the first user
    if (connections[0]) {
      simulateWebSocketEvent(server, connections[0].id, 'operation', {
        type: 'replace',
        path: '/services/api/image',
        value: 'node:18',
        userId: connections[0].userId,
        timestamp: Date.now()
      })
    }
  }, 50)

  return connections
}