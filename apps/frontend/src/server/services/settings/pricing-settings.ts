import { SettingsService } from './settings.service';

/**
 * Доменный сервис «настройки ценообразования».
 * Все потребители цены (OrderService, OrderCollectionService, UI) ходят сюда.
 *
 * Когда добавится ещё одна настройка ценообразования — добавляем поле в
 * `getPricingSettings()` и метод-сеттер, а не плодим новые сервисы.
 */
export class PricingSettingsService {
    constructor(private readonly settings: SettingsService) {}

    /** Скидка от цены за пачку бисера, %. Диапазон 0..100, дефолт 3. */
    async getBeadPackPriceDiscountPercent(): Promise<number> {
        return this.settings.get('bead_pack_price_discount_percent');
    }

    async setBeadPackPriceDiscountPercent(percent: number): Promise<void> {
        return this.settings.set('bead_pack_price_discount_percent', percent);
    }

    /** Орг. сбор по умолчанию, %. Диапазон 0..100, дефолт 0. Может быть переопределён per-товар. */
    async getOrgFeeDefaultPercent(): Promise<number> {
        return this.settings.get('org_fee_default_percent');
    }

    async setOrgFeeDefaultPercent(percent: number): Promise<void> {
        return this.settings.set('org_fee_default_percent', percent);
    }

    /** Снимок всех настроек ценообразования — для UI/выгрузок. */
    async getPricingSettings(): Promise<{
        beadPackPriceDiscountPercent: number;
        orgFeeDefaultPercent: number;
    }> {
        const values = await this.settings.getMany([
            'bead_pack_price_discount_percent',
            'org_fee_default_percent',
        ]);
        return {
            beadPackPriceDiscountPercent: values.bead_pack_price_discount_percent,
            orgFeeDefaultPercent: values.org_fee_default_percent,
        };
    }
}
