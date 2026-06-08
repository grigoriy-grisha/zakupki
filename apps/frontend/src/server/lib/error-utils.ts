import { Prisma } from '@zakupki/database';
import { TRPCError } from '@trpc/server';

export function handleDbConflict(err: unknown, message = 'Такая запись уже существует'): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = err.meta?.target;
        if (Array.isArray(target) && target.includes('tag')) {
            throw new TRPCError({
                code: 'CONFLICT',
                message: 'Закупка с таким тегом уже существует. Укажите другой тег.',
            });
        }
        throw new TRPCError({
            code: 'CONFLICT',
            message,
        });
    }
    throw err;
}

/**
 * Оборачивает вызов в try/catch для обработки ошибок уникальности БД.
 * Убирает дублирование try/catch + handleDbConflict в роутерах.
 *
 * @example
 * ```ts
 * create: adminProcedure.input(schema).mutation(async ({ ctx, input }) => {
 *     return withDbConflict(() => ctx.services.xxx.create(input));
 * }),
 * ```
 */
export async function withDbConflict<T>(fn: () => Promise<T>, message?: string): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        handleDbConflict(err, message);
    }
}
