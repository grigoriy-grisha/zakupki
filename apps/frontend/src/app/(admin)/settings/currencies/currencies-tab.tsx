'use client';

import { SimpleCrudTable } from '../shared/simple-crud-table';
import { CurrencyFormDialog } from './components/currency-form-dialog';
import { useCurrencyList, useDeleteCurrency } from './hooks/use-currencies';

export interface CurrencyRow {
    id: number;
    name: string;
    code: string | null;
    symbol: string | null;
    position: number;
    _count: { items: number; rates: number };
}

export function CurrenciesTab() {
    const { data: items, isLoading } = useCurrencyList();
    const deleteMutation = useDeleteCurrency();

    const rows = (items ?? []) as CurrencyRow[];

    return (
        <SimpleCrudTable<CurrencyRow>
            items={rows}
            isLoading={isLoading}
            deleteMutation={deleteMutation}
            renderEdit={(item) => <CurrencyFormDialog mode="edit" item={item} />}
            renderCreate={() => <CurrencyFormDialog mode="create" />}
            emptyText="Валют пока нет"
            deleteTitle="Удалить валюту"
            renderDeleteDescription={(item) => {
                const used = item._count.items > 0 || item._count.rates > 0;
                if (!used) {
                    return (
                        <>
                            Удалить <strong>{item.name}</strong>?
                        </>
                    );
                }
                const parts: string[] = [];
                if (item._count.items > 0) {
                    parts.push(
                        `${item._count.items} ${item._count.items === 1 ? 'позиции' : 'позициях'} закупок`,
                    );
                }
                if (item._count.rates > 0) {
                    parts.push(
                        `${item._count.rates} ${item._count.rates === 1 ? 'ставке' : 'ставках'} закупок`,
                    );
                }
                return (
                    <>
                        Удалить <strong>{item.name}</strong>?
                        <br />
                        Сейчас привязан к {parts.join(' и ')} — сначала переназначьте или удалите их.
                    </>
                );
            }}
            extraColumns={[
                {
                    header: 'Код',
                    render: (item) => item.code || <span className="text-fg-tertiary">—</span>,
                },
                {
                    header: 'Символ',
                    render: (item) => item.symbol || <span className="text-fg-tertiary">—</span>,
                },
                {
                    header: 'Использ.',
                    render: (item) => {
                        const total = item._count.items + item._count.rates;
                        return total > 0 ? (
                            <span className="text-fg-secondary">{total}</span>
                        ) : (
                            <span className="text-fg-tertiary">—</span>
                        );
                    },
                },
            ]}
        />
    );
}
