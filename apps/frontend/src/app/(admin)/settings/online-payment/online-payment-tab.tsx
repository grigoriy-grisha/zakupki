'use client';

import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/client/trpc';
import type { TbankTaxation, TbankVat } from '@/server/lib/tbank/types';

const TAXATION_OPTIONS: { value: TbankTaxation; label: string }[] = [
    { value: 'usn_income_outcome', label: 'УСН «доходы минус расходы»' },
    { value: 'usn_income', label: 'УСН «доходы»' },
    { value: 'osn', label: 'ОСН' },
    { value: 'esn', label: 'ЕСХН' },
    { value: 'patent', label: 'Патент' },
];

const VAT_OPTIONS: { value: TbankVat; label: string }[] = [
    { value: 'none', label: 'Без НДС' },
    { value: 'vat0', label: 'НДС 0%' },
    { value: 'vat5', label: 'НДС 5%' },
    { value: 'vat7', label: 'НДС 7%' },
    { value: 'vat10', label: 'НДС 10%' },
    { value: 'vat22', label: 'НДС 22%' },
    { value: 'vat105', label: 'НДС 5/105' },
    { value: 'vat107', label: 'НДС 7/107' },
    { value: 'vat110', label: 'НДС 10/110' },
    { value: 'vat122', label: 'НДС 22/122' },
];

function parsePercent(raw: string): number | null {
    const value = Number(raw.replace(',', '.'));
    return Number.isFinite(value) ? value : null;
}

export function OnlinePaymentTab() {
    const utils = trpc.useUtils();
    const { data, isLoading } = trpc.settings.getOnlinePayment.useQuery();

    const update = trpc.settings.updateOnlinePayment.useMutation({
        onSuccess: async () => {
            await Promise.all([utils.settings.getOnlinePayment.invalidate(), utils.payments.onlineConfig.invalidate()]);
            toast.success('Настройки онлайн-оплаты сохранены');
        },
        onError: (error) => toast.error(error.message),
    });

    const [cardFee, setCardFee] = useState('0');
    const [sbpFee, setSbpFee] = useState('0');
    const [receiptEnabled, setReceiptEnabled] = useState(true);
    const [taxation, setTaxation] = useState<TbankTaxation>('usn_income_outcome');
    const [vat, setVat] = useState<TbankVat>('none');

    useEffect(() => {
        if (!data) return;
        setCardFee(String(data.cardFeePercent));
        setSbpFee(String(data.sbpFeePercent));
        setReceiptEnabled(data.receiptEnabled);
        setTaxation(data.receiptTaxation as TbankTaxation);
        setVat(data.receiptVat as TbankVat);
    }, [data]);

    const handleSave = () => {
        const cardFeePercent = parsePercent(cardFee);
        const sbpFeePercent = parsePercent(sbpFee);
        if (cardFeePercent == null || sbpFeePercent == null) {
            toast.error('Комиссия должна быть числом');
            return;
        }
        update.mutate({ cardFeePercent, sbpFeePercent, receiptEnabled, receiptTaxation: taxation, receiptVat: vat });
    };

    if (isLoading) {
        return <div className="py-8 text-center text-fg-secondary">Загрузка...</div>;
    }

    return (
        <div className="max-w-lg space-y-6 pt-4">
            <div className="space-y-2">
                <h2 className="text-18-semibold">Онлайн-оплата</h2>
                <p className="text-14-regular text-fg-secondary">
                    Оплата заказов через интернет-эквайринг Т-Банка: картой или по СБП.
                </p>
            </div>

            {data?.enabled ? (
                <div className="flex items-start gap-2 rounded-2xl bg-bg-soft p-4 text-14-regular">
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
                    <span>Терминал Т-Банка подключён, клиенты могут оплачивать заказы онлайн.</span>
                </div>
            ) : (
                <div className="flex items-start gap-2 rounded-2xl bg-bg-soft p-4 text-14-regular">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <span>
                        Терминал не настроен: на сервере не заданы TBANK_TERMINAL_KEY, TBANK_PASSWORD или
                        APP_PUBLIC_URL. Пока их нет, клиенты не смогут оплатить заказ.
                    </span>
                </div>
            )}

            <div className="space-y-4 rounded-2xl bg-bg-soft p-4">
                <div className="space-y-1">
                    <h3 className="text-16-semibold">Комиссия для клиента</h3>
                    <p className="text-14-regular text-fg-secondary">
                        Добавляется к сумме оплаты сверху, чтобы покрыть комиссию эквайринга. 0 — без доплаты.
                    </p>
                </div>
                <div className="flex flex-wrap gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="card-fee-percent">Картой, %</Label>
                        <Input
                            id="card-fee-percent"
                            type="number"
                            min={0}
                            max={20}
                            step={0.01}
                            className="w-28"
                            value={cardFee}
                            onChange={(event) => setCardFee(event.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="sbp-fee-percent">По СБП, %</Label>
                        <Input
                            id="sbp-fee-percent"
                            type="number"
                            min={0}
                            max={20}
                            step={0.01}
                            className="w-28"
                            value={sbpFee}
                            onChange={(event) => setSbpFee(event.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4 rounded-2xl bg-bg-soft p-4">
                <div className="space-y-1">
                    <h3 className="text-16-semibold">Чеки (54-ФЗ)</h3>
                    <p className="text-14-regular text-fg-secondary">
                        Чек в формате ФФД 1.2 передаётся в онлайн-кассу, подключённую к терминалу, и отправляется
                        клиенту на email или телефон.
                    </p>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-14-regular">
                    <Checkbox
                        checked={receiptEnabled}
                        onCheckedChange={(checked) => setReceiptEnabled(checked === true)}
                    />
                    Передавать чек при онлайн-оплате
                </label>

                <div className="space-y-2">
                    <Label>Система налогообложения</Label>
                    <Select
                        value={taxation}
                        onValueChange={(value) => setTaxation(value as TbankTaxation)}
                        disabled={!receiptEnabled}
                    >
                        <SelectTrigger className="w-full sm:w-80">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TAXATION_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-12-regular text-fg-secondary">
                        Не забудьте сменить на «УСН доходы» с 1 января, если меняется режим.
                    </p>
                </div>

                <div className="space-y-2">
                    <Label>Ставка НДС</Label>
                    <Select value={vat} onValueChange={(value) => setVat(value as TbankVat)} disabled={!receiptEnabled}>
                        <SelectTrigger className="w-full sm:w-80">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {VAT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Button onClick={handleSave} disabled={update.isPending}>
                {update.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Сохранить
            </Button>
        </div>
    );
}
