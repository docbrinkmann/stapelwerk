# ADR-001: tRPC for API Layer

**Status:** Accepted  
**Date:** 2024-01-15  
**Decision Makers:** Architecture Team

## Context

We need to choose an API framework for communication between the Next.js frontend and backend services. The application requires type-safe API calls with minimal boilerplate.

### Options Considered

1. **REST with OpenAPI** - Traditional REST endpoints with schema generation
2. **GraphQL** - Flexible query language with strong typing
3. **tRPC** - End-to-end type-safe RPC framework
4. **gRPC** - High-performance RPC with Protocol Buffers

## Decision

We chose **tRPC** as our API layer.

## Rationale

### Advantages

1. **End-to-end Type Safety**
   - TypeScript types flow from backend to frontend automatically
   - No code generation step required
   - Compile-time errors for API mismatches

2. **Developer Experience**
   - Excellent IDE autocomplete for API calls
   - Minimal boilerplate compared to REST/GraphQL
   - React Query integration for data fetching

3. **Performance**
   - Request batching out of the box
   - Smaller bundle size than GraphQL clients
   - No runtime schema validation overhead

4. **Next.js Integration**
   - First-class support for Next.js App Router
   - Server Components compatibility
   - Works with existing NextAuth setup

### Trade-offs

1. **Vendor Lock-in** - tRPC is specific to TypeScript/JavaScript ecosystem
2. **Limited External Access** - Not ideal for public APIs (we can add OpenAPI layer if needed)
3. **Learning Curve** - Team needs to learn tRPC patterns

## Consequences

### Positive
- Faster development with type inference
- Fewer runtime errors from API mismatches
- Simplified error handling with built-in error types

### Negative
- Must maintain OpenAPI spec separately for external documentation
- Cannot easily consume API from non-TypeScript clients

## Implementation

```typescript
// Server: src/server/root.ts
export const appRouter = createTRPCRouter({
  gitops: gitopsRouter,
  infrastructure: infrastructureRouter,
  // ...
});

// Client: Component usage
const { data } = api.gitops.listApplications.useQuery({});
```

## Related Decisions
- ADR-002: Prisma ORM Selection
- ADR-003: NextAuth for Authentication
