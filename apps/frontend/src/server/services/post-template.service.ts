import { PostTemplateRepository } from '../domain/post-template.repository';

export class PostTemplateService {
    constructor(private repo: PostTemplateRepository) {}

    list() {
        return this.repo.list();
    }

    create(data: { name: string; body?: string }) {
        return this.repo.create(data);
    }

    update(id: number, data: { name?: string; body?: string }) {
        return this.repo.update(id, data);
    }

    delete(id: number) {
        return this.repo.delete(id);
    }
}
