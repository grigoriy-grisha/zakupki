import { assignAdminRole, dbClient, getUserRoleKind } from '../src/database.ts';

const userId = Number(process.argv[2]);
if (!Number.isFinite(userId)) {
    console.error('Usage: pnpm exec tsx scripts/grant-admin.mts <userId>');
    process.exit(1);
}

const user = await dbClient.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, vkId: true, telegramId: true },
});

if (!user) {
    console.error(`User ${userId} not found`);
    process.exit(1);
}

await assignAdminRole(userId);
const role = await getUserRoleKind(userId);

console.log(`User ${userId} (${user.firstName}): role = ${role}`);
await dbClient.$disconnect();
