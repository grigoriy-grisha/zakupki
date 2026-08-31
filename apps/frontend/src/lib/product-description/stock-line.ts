import { formatNumber } from '@/lib/utils/format';

import type { DescriptionFields } from './types';

export function formatStockLine(fields: DescriptionFields): string | null {
    const amount = fields.supplierLimit;
    const unit = fields.supplierLimitUnit;
    if (amount == null || Number(amount) < 0 || !unit) return null;
    return `${formatNumber(amount)} ${unit}`;
}
