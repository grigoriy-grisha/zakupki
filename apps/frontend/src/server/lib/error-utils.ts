import { Prisma } from '@zakupki/database';
import { TRPCError } from '@trpc/server';

export function handleDbConflict(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new TRPCError({
            code: 'CONFLICT',
            message: 'Такая запись уже существует',
        });
    }
    throw err;
}
