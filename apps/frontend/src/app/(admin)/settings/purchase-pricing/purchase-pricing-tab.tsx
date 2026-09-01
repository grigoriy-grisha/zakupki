'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { trpc } from '@/lib/client/trpc';

export function PurchasePricingTab() {
    const { isLoading, serverValue } = usePricingSettings();
    const utils = trpc.useUtils();

    const updateOrgFee = trpc.settings.updateOrgFee.useMutation({
        onSuccess: async () => {
            await utils.settings.getPricing.invalidate();
            toast.success('Настройки сохранены');
        },
        onError: (error) => toast.error(error.message),
    });

    const [orgFee, setOrgFee] = useState('0');

    useEffect(() => {
        if (serverValue?.orgFeeDefaultPercent != null) {
            setOrgFee(String(serverValue.orgFeeDefaultPercent));
        }
    }, [serverValue?.orgFeeDefaultPercent]);

    const handleSaveOrgFee = () => {
        const value = Number(orgFee.replace(',', '.'));
        if (!Number.isFinite(value)) {
            toast.error('Введите число');
            return;
        }
        updateOrgFee.mutate({ percent: value });
    };

    if (isLoading) {
        return <div className="py-8 text-center text-fg-secondary">Загрузка...</div>;
    }

    return (
        <div className="max-w-lg space-y-6 pt-4">
            <div className="space-y-2">
                <h2 className="text-18-semibold">Цены в закупках</h2>
                <p className="text-14-regular text-fg-secondary">
                    Параметры расчёта цен в таблице «Товары в закупке» и в выгрузках.
                </p>
            </div>

            <div className="space-y-4 rounded-lg border border-border-low bg-bg-card p-4">
                <div className="space-y-2">
                    <Label htmlFor="org-fee-percent">Орг. сбор по умолчанию, %</Label>
                    <p className="text-14-regular text-fg-secondary">
                        Применяется ко всем товарам закупки, если у товара не задан собственный процент.
                        У разных поставщиков орг. сбор может отличаться из-за логистики — переопределите
                        его в колонке «Цена за уп. + орг. сбор» таблицы товаров.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            id="org-fee-percent"
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="w-28"
                            value={orgFee}
                            onChange={(event) => setOrgFee(event.target.value)}
                        />
                        <Button onClick={handleSaveOrgFee} disabled={updateOrgFee.isPending}>
                            {updateOrgFee.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Сохранить
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
