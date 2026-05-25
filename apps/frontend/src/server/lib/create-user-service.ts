import { dbClient, type PrismaClient } from '@zakupki/database';

import { UserRepository } from '../domain/user.repository';
import { UserService } from '../services/user.service';

export function createUserService(db: PrismaClient = dbClient) {
    return new UserService(new UserRepository(db));
}
