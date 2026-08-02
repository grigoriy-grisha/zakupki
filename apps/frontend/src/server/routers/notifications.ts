import { z } from 'zod';

import { protectedProcedure, router } from '../trpc';

/**
 * Notifications router — scoped to the current user. The `userId` always comes
 * from `ctx.userId`, never from client input, so a user can only see / touch
 * their own notifications.
 */
export const notificationsRouter = router({
    list: protectedProcedure
        .input(z.object({ cursor: z.number().nullish() }).optional())
        .query(({ ctx, input }) => ctx.services.notification.listForUser(ctx.userId, input?.cursor ?? undefined)),

    unreadCount: protectedProcedure.query(({ ctx }) => ctx.services.notification.unreadCount(ctx.userId)),

    markRead: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ ctx, input }) => ctx.services.notification.markRead(input.id, ctx.userId)),

    markAllRead: protectedProcedure.mutation(({ ctx }) => ctx.services.notification.markAllRead(ctx.userId)),
});
