import { Prisma } from '@zakupki/database';

export function handleDbConflict(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new Prisma.PrismaClientKnownRequestError('Conflict', {
            code: 'P2002',
            clientVersion: Prisma.prismaVersion.client,
        });
    }
    throw err;
}
