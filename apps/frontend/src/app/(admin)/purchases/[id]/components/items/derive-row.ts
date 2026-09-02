import { getUnitByCode, resolveOrgFeePercent } from '@zakupki/types';

import {
    getCollectedQty,
    getPackPriceRub,
    getPackPriceWithOrgFeeRub,
    getRemainderQty,
    getUnitPriceRub,
    getUnitPriceWithDeliveryRub,
} from '../../lib/items-table-pricing';
import type { PurchaseCurrencyRateRef, PurchaseDetail } from '../../lib/types';
import type { ItemsTableRowDerived } from './items-table-row';

type ItemRow = PurchaseDetail['items'][number];

export function deriveRow(
    item: ItemRow,
    currencyRates: PurchaseCurrencyRateRef[],
    orgFeeDefaultPercent: number,
    deliveryPercent: number,
    fulfillmentStatus: PurchaseDetail['fulfillmentStatus'],
    status: PurchaseDetail['status'],
    isActive: boolean,
): ItemsTableRowDerived {
    const published = !!item.tgMessageId && !item.hidden;
    const orgFeePercent = resolveOrgFeePercent(
        item.orgFeePercentOverride != null ? Number(item.orgFeePercentOverride) : null,
        orgFeeDefaultPercent,
    );

    return {
        shortName: getUnitByCode(item.product.unitCode)?.shortName ?? '',
        published,
        packPriceRub: getPackPriceRub(item, currencyRates),
        packPriceWithOrgFeeRub: getPackPriceWithOrgFeeRub(item, currencyRates, orgFeeDefaultPercent),
        unitPriceRub: getUnitPriceRub(item, currencyRates, orgFeeDefaultPercent),
        unitPriceWithDeliveryRub: getUnitPriceWithDeliveryRub(
            item,
            currencyRates,
            orgFeeDefaultPercent,
            deliveryPercent,
        ),
        collectedQty: getCollectedQty(item),
        remainderQty: getRemainderQty(item, fulfillmentStatus),
        orgFeePercent,
        isDone: status === 'DONE',
        isActive,
    };
}
