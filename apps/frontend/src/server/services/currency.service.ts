import { NotFoundError, ValidationError } from '@zakupki/types';

import { CurrencyRepository } from '../domain/currency.repository';

export class CurrencyService {
    constructor(private repo: CurrencyRepository) {}

    list() {
        return this.repo.list();
    }

    async findById(id: number) {
        const currency = await this.repo.findById(id);
        if (!currency) throw new NotFoundError('Валюта', id);
        return currency;
    }

    create(data: { name: string; code?: string; symbol?: string }) {
        return this.repo.create({
            name: data.name.trim(),
            code: data.code?.trim() || null,
            symbol: data.symbol?.trim() || null,
        });
    }

    async update(
        id: number,
        data: Partial<{
            name: string;
            code: string | null;
            symbol: string | null;
            position: number;
        }>,
    ) {
        const currency = await this.repo.findById(id);
        if (!currency) throw new NotFoundError('Валюта', id);

        const normalized: typeof data = { ...data };
        if (normalized.name !== undefined) normalized.name = normalized.name.trim();
        if (normalized.code !== undefined) normalized.code = normalized.code?.trim() || null;
        if (normalized.symbol !== undefined) normalized.symbol = normalized.symbol?.trim() || null;

        return this.repo.update(id, normalized);
    }

    async delete(id: number) {
        const currency = await this.repo.findById(id);
        if (!currency) throw new NotFoundError('Валюта', id);

        const { itemsCount, ratesCount } = await this.repo.countUsage(id);
        if (itemsCount > 0 || ratesCount > 0) {
            const parts: string[] = [];
            if (itemsCount > 0) {
                parts.push(`${itemsCount} ${pluralizeItem(itemsCount)} закупок`);
            }
            if (ratesCount > 0) {
                parts.push(`${ratesCount} ${pluralizeRate(ratesCount)} закупок`);
            }
            throw new ValidationError(
                `Нельзя удалить «${currency.name}» — используется в ${parts.join(' и ')}. Сначала удалите или переназначьте.`,
            );
        }
        return this.repo.delete(id);
    }
}

function pluralizeItem(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'позиции';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'позициях';
    return 'позициях';
}

function pluralizeRate(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'ставке';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ставках';
    return 'ставках';
}
