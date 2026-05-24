import { RoleKind } from '../generated/client/client';

import { dbClient } from './database';

export { RoleKind };

export async function getClientRoleId() {
    const role = await dbClient.role.findUnique({ where: { kind: RoleKind.CLIENT } });
    if (!role) throw new Error('Role CLIENT is not seeded. Run migrations.');
    return role.id;
}

/** Assign CLIENT if the user has no role yet (does not downgrade ADMIN). */
export async function ensureClientRole(userId: number) {
    const existing = await dbClient.userRole.findUnique({ where: { userId } });
    if (existing) return existing;

    const roleId = await getClientRoleId();
    return dbClient.userRole.create({ data: { userId, roleId } });
}

export async function getUserRoleKind(userId: number): Promise<RoleKind> {
    const userRole = await dbClient.userRole.findUnique({
        where: { userId },
        include: { role: true },
    });
    return userRole?.role.kind ?? RoleKind.CLIENT;
}

export async function assignAdminRole(userId: number) {
    const adminRole = await dbClient.role.findUnique({ where: { kind: RoleKind.ADMIN } });
    if (!adminRole) throw new Error('Role ADMIN is not seeded. Run migrations.');

    return dbClient.userRole.upsert({
        where: { userId },
        update: { roleId: adminRole.id },
        create: { userId, roleId: adminRole.id },
    });
}
