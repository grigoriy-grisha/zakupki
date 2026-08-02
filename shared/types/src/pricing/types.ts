/**
 * Ценовая ступень — legacy, используется только в Excel export и UI отображении
 * старых данных. В расчётах цены больше не участвует.
 */
export type PriceTier = {
    amount: number;
    unit?: string;
    price: number;
};

/**
 * Опции количества заказа для валидации и расчётов
 */
export type OrderQuantityOptions = {
    multiplicity?: number | null;
    minPackageAmount?: number | null;
    minPackageUnit?: string | null;
    purchaseItemMinQty?: number | null;
    unitShort?: string | null;
    /**
     * Код единицы учёта товара ('gram', 'piece', 'tube').
     * Используется для дефолтного шага по единице (напр. gram → 5),
     * когда minPackageAmount и multiplicity не заданы.
     */
    unitCode?: string | null;
};
