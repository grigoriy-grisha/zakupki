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
    const [loading, setLoading] = useState<'general' | 'orders' | null>(null);
    const utils = trpc.useUtils();

    async function fetchExportData() {
        const [purchase, orders, payments, attributeTypes] = await Promise.all([
            utils.purchases.getById.fetch({ id: purchaseId }),
            utils.orders.getAllByPurchase.fetch({ purchaseId }),
            utils.payments.getByPurchase.fetch({ purchaseId }),
            utils.attributeTypes.list.fetch(),
        ]);

        if (!purchase) {
            throw new Error('Закупка не найдена');
        }

        return {
            purchase,
            orders: orders ?? [],
            payments: payments ?? [],
            attributeTypes: attributeTypes ?? [],
        };
    }

    async function handleExport(type: 'general' | 'orders') {
        setLoading(type);
        try {
            const data = await fetchExportData();
            const { exportGeneralPurchaseData, exportOrdersPurchaseData } = await import(
                '../lib/export-purchase-excel'
            );

            if (type === 'general') {
                await exportGeneralPurchaseData(data);
            } else {
                await exportOrdersPurchaseData(data);
            }
        } catch {
            toast.error('Не удалось выгрузить файл');
        } finally {
            setLoading(null);
        }
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                disabled={loading !== null}
                onClick={() => void handleExport('general')}
            >
                {loading === 'general' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                Выгрузить общие данные
            </Button>
            <Button
                variant="outline"
                size="sm"
                disabled={loading !== null}
                onClick={() => void handleExport('orders')}
            >
                {loading === 'orders' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                Выгрузить данные заказов
            </Button>
        </div>
    );
}
