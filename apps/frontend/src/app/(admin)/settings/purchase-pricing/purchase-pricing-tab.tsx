'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { trpc } from '@/lib/client/trpc';
import { usePricingSettings } from '@/lib/client/hooks/use-pricing-settings';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function PurchasePricingTab() {
    const { isLoading, serverValue } = usePricingSettings();
    const utils = trpc.useUtils();
    const updateDiscount = trpc.settings.updateBeadPackDiscount.useMutation({
        onSuccess: async () => {
            await utils.settings.getPricing.invalidate();
            toast.success('Настройки сохранены');
        },
        onError: (error) => toast.error(error.message),
    });

    const [percent, setPercent] = useState('3');

    useEffect(() => {
        if (serverValue?.beadPackPriceDiscountPercent != null) {
            setPercent(String(serverValue.beadPackPriceDiscountPercent));
        }
    }, [serverValue?.beadPackPriceDiscountPercent]);

    const handleSave = () => {
        const value = Number(percent.replace(',', '.'));
        if (!Number.isFinite(value)) {
            toast.error('Введите число');
            return;
        }
        updateDiscount.mutate({ percent: value });
    };

    if (isLoading) {
        return <div className="py-8 text-center text-muted-foreground">Загрузка...</div>;
    }

    return (
        <div className="max-w-lg space-y-6 pt-4">
            <div className="space-y-2">
                <h2 className="text-base font-medium">Цены в закупках</h2>
                <p className="text-sm text-muted-foreground">
                    Параметры расчёта цен в таблице «Товары в закупке» и в выгрузках.
                </p>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
                <div className="space-y-2">
                    <Label htmlFor="bead-pack-discount">Скидка за цену за пачку бисера, %</Label>
                    <p className="text-sm text-muted-foreground">
                        От цены за пачку у поставщика вычитается этот процент. Колонка «Цена за пачку со скидкой» = цена
                        за пачку − указанный %.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Input
                            id="bead-pack-discount"
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            className="w-28"
                            value={percent}
                            onChange={(event) => setPercent(event.target.value)}
                        />
                        <Button onClick={handleSave} disabled={updateDiscount.isPending}>
                            {updateDiscount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Сохранить
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
