import { z } from 'zod';

import { PostTemplateRepository } from '../domain/post-template.repository';
import { PostTemplateService } from '../services/post-template.service';
import type { PrismaClient } from '@zakupki/database';
import { adminProcedure, protectedProcedure, router } from '../trpc';

function services(db: PrismaClient) {
    return { templates: new PostTemplateService(new PostTemplateRepository(db)) };
}

export const postTemplatesRouter = router({
    list: protectedProcedure.query(async ({ ctx }) => {
        const { templates } = services(ctx.db);
        return templates.list();
    }),

    create: adminProcedure
        .input(z.object({ name: z.string().trim().min(1), body: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const { templates } = services(ctx.db);
            return templates.create(input);
        }),

    update: adminProcedure
        .input(
            z.object({
                id: z.number(),
                name: z.string().trim().min(1).optional(),
                body: z.string().optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const { id, ...data } = input;
            const { templates } = services(ctx.db);
            return templates.update(id, data);
        }),

    delete: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
        const { templates } = services(ctx.db);
        return templates.delete(input.id);
    }),
});
