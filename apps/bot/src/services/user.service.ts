import type { PrismaClient } from '@zakupki/database';
import { UserRepository } from '../domain/repositories/user.repository';

export class UserService {
    private repo: UserRepository;

    constructor(db: PrismaClient) {
        this.repo = new UserRepository(db);
    }

    refreshProfile(userId: number, data: { firstName: string; lastName?: string; username?: string }) {
        return this.repo.refreshProfile(userId, data);
    }

    createOrGetUser(telegramId: string, info: { firstName: string; lastName?: string; username?: string }) {
        return this.repo.createOrGetUser(telegramId, info);
    }
}
