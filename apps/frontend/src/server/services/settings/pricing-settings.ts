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

    /** Снимок всех настроек ценообразования — для UI/выгрузок. */
    async getPricingSettings(): Promise<{ beadPackPriceDiscountPercent: number }> {
        const values = await this.settings.getMany(['bead_pack_price_discount_percent']);
        return { beadPackPriceDiscountPercent: values.bead_pack_price_discount_percent };
    }
}
