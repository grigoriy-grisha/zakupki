import { UserRepository } from '../domain/user.repository';

export class UserService {
    constructor(private repo: UserRepository) {}

    async list() {
        return this.repo.list();
    }

    async upsert(telegramId: string, data: { username?: string; firstName: string; lastName?: string }) {
        return this.repo.upsert(telegramId, data);
    }
}
