import { createInMemoryPrismaClient } from './prisma-inmemory'

// One shared in-memory database per test file (worker). Without the
// singleton, every prisma entry point (@prisma/client constructor, the
// @/lib/database/prisma and @/lib/db-utils mocks) got its OWN store —
// routers wrote to one database while test assertions read another.
//
// Lives in its own module (NOT prisma-client-proxy) because that file is
// what the '@prisma/client' vitest alias resolves to — importing it from
// inside the '@prisma/client' mock factory would be a self-reference.
let sharedClient: any

export function getSharedInMemoryClient() {
  if (!sharedClient) sharedClient = createInMemoryPrismaClient()
  return sharedClient
}
