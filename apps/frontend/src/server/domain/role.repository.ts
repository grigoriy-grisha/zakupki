import type { PrismaClient, RoleKind } from '@zakupki/database';

export class RoleRepository {
    constructor(private db: PrismaClient) {}

    async findByKind(kind: RoleKind) {
        return this.db.role.findUnique({ where: { kind } });
    }

    async getUserRole(userId: number) {
        return this.db.userRole.findUnique({
            where: { userId },
            include: { role: true },
        });
    }

    async getUserRoleKind(userId: number): Promise<RoleKind> {
        const userRole = await this.getUserRole(userId);
        return userRole?.role.kind ?? 'CLIENT';
    }

    async getClientRoleId() {
        const role = await this.findByKind('CLIENT');
        if (!role) throw new Error('Role CLIENT is not seeded. Run migrations.');
        return role.id;
    }

    async getAdminRoleId() {
        const role = await this.findByKind('ADMIN');
        if (!role) throw new Error('Role ADMIN is not seeded. Run migrations.');
        return role.id;
    }

    async ensureClientRole(userId: number) {
        const existing = await this.db.userRole.findUnique({ where: { userId } });
        if (existing) return existing;

        const roleId = await this.getClientRoleId();
        return this.db.userRole.create({ data: { userId, roleId } });
    }

    async assignRole(userId: number, kind: RoleKind) {
        const role = await this.findByKind(kind);
        if (!role) throw new Error(`Role ${kind} is not seeded. Run migrations.`);

        return this.db.userRole.upsert({
            where: { userId },
            update: { roleId: role.id },
            create: { userId, roleId: role.id },
        });
    }
}
