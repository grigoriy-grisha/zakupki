import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { appRouter } from '@/server/routers/_app';
import { API_ROUTES } from '@/lib/constants';
import { createTRPCContext } from '@/server/trpc';

const handler = (req: Request) =>
    fetchRequestHandler({
        endpoint: API_ROUTES.trpc,
        req,
        router: appRouter,
        createContext: createTRPCContext,
    });

export { handler as GET, handler as POST };
