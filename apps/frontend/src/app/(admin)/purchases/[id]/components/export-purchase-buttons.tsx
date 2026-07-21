'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/client/trpc';

interface ExportPurchaseButtonsProps {
    purchaseId: number;
}

export function ExportPurchaseButtons({ purchaseId }: ExportPurchaseButtonsProps) {
    const [loading, setLoading] = useState(false);
    const utils = trpc.useUtils();

    async function handleExportOrders() {
        setLoading(true);
        try {
            const [purchase, orders, payments, attributeTypes] = await Promise.all([
                utils.purchases.getById.fetch({ id: purchaseId }),
                utils.orders.getAllByPurchase.fetch({ purchaseId }),
                utils.payments.getByPurchase.fetch({ purchaseId }),
                utils.attributeTypes.list.fetch(),
            ]);

            if (!purchase) {
                throw new Error('Закупка не найдена');
            }

            const { exportOrdersPurchaseData } = await import('../lib/export-purchase-excel');
            await exportOrdersPurchaseData({
                purchase: purchase as never,
                orders: orders ?? [],
                payments: payments ?? [],
                attributeTypes: attributeTypes ?? [],
            });
        } catch {
            toast.error('Не удалось выгрузить файл');
        } finally {
            setLoading(false);
        }
    }

    return (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void handleExportOrders()}>
            {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Download className="mr-2 h-4 w-4" />
            )}
            Выгрузить данные заказов
        </Button>
    );
}
