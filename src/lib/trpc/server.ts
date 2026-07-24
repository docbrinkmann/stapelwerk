import { appRouter } from "@/server/root";
import { createTRPCContext } from "@/server/trpc";
import { getPageSession } from "@/lib/auth";
import { cache } from "react";

// Server-component tRPC caller. It must carry the authenticated session —
// otherwise every protected/admin procedure prefetched from an RSC (e.g. the
// admin template-approval page) sees no user and throws UNAUTHORIZED.
const createContext = cache(async () => {
  const session = await getPageSession();
  return createTRPCContext({ user: session?.user ?? undefined });
});

export const trpc = appRouter.createCaller(createContext);