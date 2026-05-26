import type { RoleKind } from '@zakupki/database';

import { RoleRepository } from '../domain/role.repository';

export class RoleService {
    constructor(private repo: RoleRepository) {}

    async getUserRoleKind(userId: number): Promise<RoleKind> {
        return this.repo.getUserRoleKind(userId);
    }

    async ensureClientRole(userId: number) {
        return this.repo.ensureClientRole(userId);
    }

    async assignAdminRole(userId: number) {
        return this.repo.assignRole(userId, 'ADMIN');
    }

    async assignClientRole(userId: number) {
        return this.repo.assignRole(userId, 'CLIENT');
    }
}
