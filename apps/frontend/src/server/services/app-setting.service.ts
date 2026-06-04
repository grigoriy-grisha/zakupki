import { APP_SETTING_KEYS, DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT, ValidationError } from '@zakupki/types';

import { AppSettingRepository } from '../domain/app-setting.repository';

function parseDiscountPercent(value: string | undefined | null): number {
    if (value == null || value.trim() === '') {
        return DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        throw new ValidationError('Скидка должна быть числом от 0 до 100');
    }
    return parsed;
}

export class AppSettingService {
    constructor(private repo: AppSettingRepository) {}

    async getBeadPackPriceDiscountPercent(): Promise<number> {
        try {
            const row = await this.repo.get(APP_SETTING_KEYS.BEAD_PACK_PRICE_DISCOUNT_PERCENT);
            if (!row) {
                return DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;
            }
            return parseDiscountPercent(row.value);
        } catch (error) {
            console.error('[AppSetting] getBeadPackPriceDiscountPercent failed:', error);
            return DEFAULT_BEAD_PACK_PRICE_DISCOUNT_PERCENT;
        }
    }

    async setBeadPackPriceDiscountPercent(percent: number) {
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
            throw new ValidationError('Скидка должна быть от 0 до 100%');
        }
        try {
            await this.repo.set(APP_SETTING_KEYS.BEAD_PACK_PRICE_DISCOUNT_PERCENT, String(percent));
        } catch (error) {
            console.error('[AppSetting] setBeadPackPriceDiscountPercent failed:', error);
            throw new ValidationError(
                'Не удалось сохранить настройку. Проверьте подключение к БД и примените миграции (prisma migrate deploy).',
            );
        }
        return { beadPackPriceDiscountPercent: percent };
    }

    async getPricingSettings() {
        const beadPackPriceDiscountPercent = await this.getBeadPackPriceDiscountPercent();
        return { beadPackPriceDiscountPercent };
    }
}
