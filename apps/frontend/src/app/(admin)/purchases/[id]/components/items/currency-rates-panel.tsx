'use client';

import { Loader2,Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/client/trpc';

import type { PurchaseCurrencyRateRef } from '../../lib/types';

interface CurrencyRatesPanelProps {
    purchaseId: number;
    rates: PurchaseCurrencyRateRef[];
}

interface RateDraft {
    currencyId: number;
    rateToRub: string;
}

const MAX_CURRENCIES = 3;

/**
 * Разбирает строку курса (допускает запятую вместо точки) в число.
 * Возвращает null, если значение пустое или не парсится в положительное число.
 */
function parseRate(raw: string): number | null {
    const normalized = raw.trim().replace(',', '.');
    if (normalized === '') return null;
    const n = Number(normalized);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

/**
 * Панель «Валюты закупки»: выбор ≤3 валют из справочника + ввод курса к рублю.
 * Сохраняет массив одной мутацией purchases.updateCurrencyRates (полная замена).
 *
 * Drafts синхронизируются с серверным `rates` через useEffect — при внешнем
 * обновлении (например, после инвалидации кэша) черновик сбрасывается к актуальным
 * значениям, пока пользователь не начал редактирование.
 */
export function CurrencyRatesPanel({ purchaseId, rates }: CurrencyRatesPanelProps) {
    const utils = trpc.useUtils();
    const [editing, setEditing] = useState(false);

    // Грузим справочник валют только когда пользователь начинает редактирование —
    // на странице закупки этот запрос не нужен, пока панель свёрнута.
    const { data: currencies } = trpc.currencies.list.useQuery(undefined, {
        enabled: editing,
    });

    const [drafts, setDrafts] = useState<RateDraft[]>(() =>
        rates.map((r) => ({ currencyId: r.currencyId, rateToRub: String(r.rateToRub) })),
    );

    // Синхронизируем drafts с серверными rates, когда те меняются извне
    // (инвалидация кэша после save, смена закупки и т.д.). Пока пользователь
    // редактирует — не трогаем, чтобы не затереть его ввод.
    useEffect(() => {
        setDrafts(rates.map((r) => ({ currencyId: r.currencyId, rateToRub: String(r.rateToRub) })));
    }, [rates]);

    const updateRates = trpc.purchases.updateCurrencyRates.useMutation({
        onSuccess: async () => {
            await utils.purchases.getById.invalidate({ id: purchaseId });
            toast.success('Курсы валют сохранены');
            setEditing(false);
        },
        onError: (err) => toast.error(err.message),
    });

    const usedCurrencyIds = new Set(drafts.map((d) => d.currencyId));
    const availableCurrencies = (currencies ?? []).filter((c) => !usedCurrencyIds.has(c.id));
    const canAddMore = drafts.length < MAX_CURRENCIES;

    function addRate(currencyId: number) {
        setDrafts((prev) => [...prev, { currencyId, rateToRub: '' }]);
    }

    function updateRate(index: number, patch: Partial<RateDraft>) {
        setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    }

    function removeRate(index: number) {
        setDrafts((prev) => prev.filter((_, i) => i !== index));
    }

    function handleSave() {
        // Явная валидация: каждая строка с валютой обязана иметь положительный курс.
        // Не отбрасываем молча — показываем, какая валюта без курса.
        const invalid = drafts.filter((d) => parseRate(d.rateToRub) == null);
        if (invalid.length > 0) {
            const names = invalid
                .map((d) => {
                    const c = (currencies ?? []).find((x) => x.id === d.currencyId);
                    return c?.name ?? `#${d.currencyId}`;
                })
                .join(', ');
            toast.error(`Укажите курс больше 0 для: ${names}`);
            return;
        }
        updateRates.mutate({
            purchaseId,
            rates: drafts.map((d) => ({
                currencyId: d.currencyId,
                rateToRub: parseRate(d.rateToRub)!,
            })),
        });
    }

    function handleCancel() {
        setDrafts(rates.map((r) => ({ currencyId: r.currencyId, rateToRub: String(r.rateToRub) })));
        setEditing(false);
    }

    const currencyName = (id: number) => {
        const c = (currencies ?? []).find((x) => x.id === id);
        return c ? `${c.name}${c.code ? ` (${c.code})` : ''}` : `#${id}`;
    };

    return (
        <div className="rounded-2xl border border-border bg-bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <h3 className="text-14-medium">Валюты закупки</h3>
                    <p className="text-12-regular text-fg-tertiary">
                        До 3 валют. Курс вводится вручную для каждой закупки.
                    </p>
                </div>
                {!editing && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        Редактировать
                    </Button>
                )}
            </div>

            {!editing ? (
                <div className="flex flex-wrap gap-2">
                    {rates.length === 0 ? (
                        <p className="text-13-regular text-fg-tertiary">Валюты не заданы.</p>
                    ) : (
                        rates.map((r) => (
                            <div
                                key={r.currencyId}
                                className="flex items-center gap-2 rounded-full bg-bg-soft px-3 py-1.5 text-13-medium"
                            >
                                <span>
                                    {r.currency.name}
                                    {r.currency.symbol ? ` ${r.currency.symbol}` : ''}:
                                </span>
                                <span className="tabular-nums">{String(r.rateToRub)} ₽</span>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {drafts.map((d, index) => (
                        <div key={d.currencyId} className="flex items-center gap-2">
                            <div className="w-48">
                                <Label className="sr-only">Валюта</Label>
                                <div className="flex h-9 items-center rounded-md border border-input bg-background px-3 text-13-regular">
                                    {currencyName(d.currencyId)}
                                </div>
                            </div>
                            <div className="flex-1">
                                <Label className="sr-only">Курс к рублю</Label>
                                <Input
                                    type="number"
                                    step="0.0001"
                                    min={0}
                                    placeholder="Курс к рублю"
                                    value={d.rateToRub}
                                    onChange={(e) => updateRate(index, { rateToRub: e.target.value })}
                                    className="text-13-regular"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 text-fg-tertiary hover:text-destructive"
                                onClick={() => removeRate(index)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                    {canAddMore && availableCurrencies.length > 0 && (
                        <Select
                            value=""
                            onValueChange={(v) => {
                                addRate(Number(v));
                            }}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="+ Добавить валюту" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableCurrencies.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                        {c.name}
                                        {c.code ? ` (${c.code})` : ''}
                                        {c.symbol ? ` ${c.symbol}` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <div className="flex items-center gap-2">
                        <Button onClick={handleSave} disabled={updateRates.isPending} size="sm">
                            {updateRates.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Сохранить
                        </Button>
                        <Button variant="ghost" onClick={handleCancel} size="sm">
                            Отмена
                        </Button>
                        {(currencies ?? []).length === 0 && (
                            <span className="text-12-regular text-fg-tertiary">
                                Сначала создайте валюты в настройках.
                            </span>
                        )}
                    </div>
                    {canAddMore && availableCurrencies.length === 0 && (currencies ?? []).length > 0 && (
                        <p className="flex items-center gap-1 text-12-regular text-fg-tertiary">
                            <Plus className="h-3 w-3" /> Все валюты справочника уже добавлены.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
