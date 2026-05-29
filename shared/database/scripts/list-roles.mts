import { dbClient } from '../src/database.ts';

const roles = await dbClient.role.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { kind: 'asc' },
});

if (roles.length === 0) {
    console.log('No roles in database. Run migrations and seed.');
    process.exit(0);
}

for (const role of roles) {
    console.log(`${role.kind}: ${role._count.users} user(s)`);
}

await dbClient.$disconnect();
