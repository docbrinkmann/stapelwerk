// Compatibility alias: map tRPC-style client to existing api stub
// This allows modules importing '@/utils/trpc' to work by reusing the same client shape.
export { trpc } from '@/trpc/react-client';
export { api } from '@/trpc/client';
