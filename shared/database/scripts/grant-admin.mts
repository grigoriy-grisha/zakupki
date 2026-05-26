import { dbClient } from '../src/database.ts';

const userId = Number(process.argv[2]);
if (!Number.isFinite(userId)) {
    console.error('Usage: pnpm exec tsx scripts/grant-admin.mts <userId>');
    process.exit(1);
}

const user = await dbClient.user.findUnique({
    where: { id: userId },
    select: {
        id: true,
        firstName: true,
        lastName: true,
        vkCredential: { select: { vkId: true } },
        telegramCredential: { select: { telegramId: true } },
    },
});

if (!user) {
    console.error(`User ${userId} not found`);
    process.exit(1);
}

const adminRole = await dbClient.role.findUnique({ where: { kind: 'ADMIN' } });
if (!adminRole) {
    console.error('Role ADMIN is not seeded. Run migrations.');
    process.exit(1);
}

await dbClient.userRole.upsert({
    where: { userId },
    update: { roleId: adminRole.id },
    create: { userId, roleId: adminRole.id },
});

const userRole = await dbClient.userRole.findUnique({
    where: { userId },
    include: { role: true },
});

console.log(`User ${userId} (${user.firstName}): role = ${userRole?.role.kind ?? 'unknown'}`);
await dbClient.$disconnect();
