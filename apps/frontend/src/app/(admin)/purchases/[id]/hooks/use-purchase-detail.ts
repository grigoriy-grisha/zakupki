'use client';

import { trpc } from '@/lib/client/trpc';

import type { PurchaseDetail } from '../lib/types';

/**
 * Типизированный wrapper над `purchases.getById`. React Query дедуплицирует
 * по ключу кэша, так что выигрыш здесь — единая точка каста к `PurchaseDetail`,
 * а не перформанс.
 */
export function usePurchaseDetail(purchaseId: number, options?: { enabled?: boolean }) {
    const query = trpc.purchases.getById.useQuery({ id: purchaseId }, options);
    return {
        ...query,
        detail: (query.data ?? null) as PurchaseDetail | null,
    };
}
