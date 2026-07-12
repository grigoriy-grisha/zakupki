import { NotFoundError, ValidationError } from '@zakupki/types';

import { SupplierRepository } from '../domain/supplier.repository';

export class SupplierService {
    constructor(private repo: SupplierRepository) {}

    list() {
        return this.repo.list();
    }

    async findById(id: number) {
        const supplier = await this.repo.findById(id);
        if (!supplier) throw new NotFoundError('Поставщик', id);
        return supplier;
    }

    create(data: { name: string; contact?: string; notes?: string }) {
        return this.repo.create({
            name: data.name.trim(),
            contact: data.contact?.trim() || null,
            notes: data.notes?.trim() || null,
        });
    }

    async update(
        id: number,
        data: Partial<{ name: string; contact: string | null; notes: string | null; position: number }>,
    ) {
        const supplier = await this.repo.findById(id);
        if (!supplier) throw new NotFoundError('Поставщик', id);

        const normalized: typeof data = { ...data };
        if (normalized.name !== undefined) normalized.name = normalized.name.trim();
        if (normalized.contact !== undefined) normalized.contact = normalized.contact?.trim() || null;
        if (normalized.notes !== undefined) normalized.notes = normalized.notes?.trim() || null;

        return this.repo.update(id, normalized);
    }

    async delete(id: number) {
        const supplier = await this.repo.findById(id);
        if (!supplier) throw new NotFoundError('Поставщик', id);

        const usageCount = await this.repo.countItems(id);
        if (usageCount > 0) {
            throw new ValidationError(
                `Нельзя удалить «${supplier.name}» — используется в ${usageCount} ${pluralizePosition(usageCount)} закупок. Сначала удалите или переназначьте позиции.`,
            );
        }
        return this.repo.delete(id);
    }
}

function pluralizePosition(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'позиции';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'позициях';
    return 'позициях';
}
