import { dbClient, type PrismaClient } from '@zakupki/database';

import { RoleRepository } from '../domain/role.repository';
import { UserRepository } from '../domain/user.repository';
import { RoleService } from '../services/role.service';
import { UserService } from '../services/user.service';

export function createUserService(db: PrismaClient = dbClient) {
    const roleService = new RoleService(new RoleRepository(db));
    return new UserService(new UserRepository(db), roleService);
}

export function createRoleService(db: PrismaClient = dbClient) {
    return new RoleService(new RoleRepository(db));
}
