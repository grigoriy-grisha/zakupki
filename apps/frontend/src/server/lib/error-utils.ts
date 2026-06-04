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
