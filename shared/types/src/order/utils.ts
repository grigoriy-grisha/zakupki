/** Доменные утилиты заказа (без внешних зависимостей). */
import { getUnitByCode } from '../units';

/** Короткое название единицы по коду, с fallback на «ед.». */
export function getUnitShortName(unitCode: string): string {
    return getUnitByCode(unitCode)?.shortName ?? 'ед.';
}
