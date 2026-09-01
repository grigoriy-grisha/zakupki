'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function ItemsTableHeader({
    selectableCount,
    allSelected,
    someSelected,
    onToggleAll,
}: {
    selectableCount: number;
    allSelected: boolean;
    someSelected: boolean;
    onToggleAll: (v: boolean) => void;
}) {
    return (
        <TableHeader>
            <TableRow>
                <TableHead className="sticky left-0 z-10 w-[200px] bg-bg-soft">Товар</TableHead>
                <TableHead className="w-[140px] px-3 text-right">Вес упаковки</TableHead>
                <TableHead className="w-[160px] px-3 text-right">Цена за упаковку</TableHead>
                <TableHead className="w-[150px] px-3 text-right">Цена за упаковку ₽</TableHead>
                <TableHead className="w-[170px] px-3 text-right">Цена за упаковку + орг</TableHead>
                <TableHead className="w-[150px] px-3 text-right">Цена за 1 единицу ₽</TableHead>
                <TableHead className="w-[130px] px-3 text-right">Собрано</TableHead>
                <TableHead className="w-[120px] px-3 text-right">Заказано</TableHead>
                <TableHead className="w-[140px] px-3 text-right">Скомплектовано</TableHead>
                <TableHead className="w-[130px] px-3 text-right">Дозаказано</TableHead>
                <TableHead className="w-[120px] px-3 text-right">Остаток</TableHead>
                <TableHead className="w-[120px] px-3">Комментарий</TableHead>
                <TableHead className="w-[72px] px-2 text-center">
                    {selectableCount > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                            <Checkbox
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                aria-label="Выбрать все для публикации в Telegram"
                                onCheckedChange={(v) => onToggleAll(v === true)}
                            />
                            <span className="text-11-medium text-fg-tertiary">TG</span>
                        </div>
                    ) : (
                        'TG'
                    )}
                </TableHead>
                <TableHead className="sticky right-0 z-10 w-[56px] bg-bg-soft" />
            </TableRow>
        </TableHeader>
    );
}
