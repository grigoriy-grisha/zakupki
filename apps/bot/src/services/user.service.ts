import { UserRepository } from '../domain/repositories/user.repository';

export class UserService {
    private repo = new UserRepository();

    refreshProfile(userId: number, data: { firstName: string; lastName?: string; username?: string }) {
        return this.repo.refreshProfile(userId, data);
    }

    createOrGetUser(telegramId: string, info: { firstName: string; lastName?: string; username?: string }) {
        return this.repo.createOrGetUser(telegramId, info);
    }
}
