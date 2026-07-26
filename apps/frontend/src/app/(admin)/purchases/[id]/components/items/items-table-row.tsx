'use client';

import { useEffect, useState } from 'react';
import { EyeOff, MoreHorizontal, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { PackageUnitSelect } from '@/components/shared/package-unit-select';
import { TruncatedText } from '@/components/shared/truncated-text';
import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';
import type { ProductLabelSource } from '../../../../products/lib';
import type { PurchaseCurrencyRateRef, PurchaseItem } from '../../lib/types';
import { InlineCell } from './inline-cell';

/** Форматирует число как рубли: `1 234,56 ₽`. Пусто/NaN → `—`. */
function formatRubPrice(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(value)) return '—';
    return `${value.toLocaleString('ru-RU')} ₽`;
}

/** Вычисленные значения колонок новой модели цен (считаются в items-tab). */
export interface ItemsTableRowDerived {
    /** Короткое имя единицы (гр/шт). */
    shortName: string;
    published: boolean;
    /** Кол. 4: цена упаковки в ₽. */
    packPriceRub: number | null;
    /** Кол. 5: цена упаковки с оргсбором в ₽. */
    packPriceWithOrgFeeRub: number | null;
    /** Кол. 6: цена за 1ед в ₽. */
    unitPriceRub: number | null;
    /** Кол. 7: собрано (сумма quantity ACTIVE orderLines). */
    collectedQty: number;
    /** Кол. 11: остаток на пристрой. */
    remainderQty: number | null;
    /** Применённый % оргсбора (override или глобальный). */
    orgFeePercent: number;
    isDone: boolean;
    isActive: boolean;
}

/** Частичный payload для updateItemProduct — только изменившиеся поля. */
type ItemPatch = Partial<{
    packAmount: number | null;
    packUnit: string | null;
    currencyId: number | null;
    pricePerPackCurrency: number | null;
    orderedQty: number | null;
    assembledQty: number | null;
    reorderedQty: number | null;
    adminComment: string | null;
    hidden: boolean;
}>;

interface ItemsTableRowProps {
    item: PurchaseItem;
    derived: ItemsTableRowDerived;
    /** Курс валют закупки (для расчёта производных колонок 4/5/6). */
    currencyRates: PurchaseCurrencyRateRef[];
    selected: boolean;
    onToggleSelect: (id: number, v: boolean) => void;
    onEdit: (id: number) => void;
    onPublish: (id: number) => void;
    onDelete: (target: {
        id: number;
        product: ProductLabelSource;
        orderCount: number;
        published: boolean;
    }) => void;
    /** Тихий inline-коммит одного/нескольких полей позиции. */
    onCommit: (patch: ItemPatch) => void;
    /**
     * Перегенерировать описание из шаблона поста (для опубликованных товаров).
     * Открывает диалог выбора шаблона; сервер пересоберёт description и обновит пост.
     */
    onRegenerate?: (target: { itemId: number }) => void;
}

function numOrDash(value: string | number | null | undefined): string {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    // Целые — без дробной части, иначе 3 знака с обрезкой нулей.
    return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
}

/**
 * Ячейка комментария: показывает текст (или «—») с иконкой карандаша.
 * Клик открывает широкий диалог с Textarea для редактирования.
 */
function CommentCell({
    value,
    onCommit,
}: {
    value: string | null | undefined;
    onCommit: (next: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value ?? '');

    useEffect(() => {
        if (open) setDraft(value ?? '');
    }, [open, value]);

    function handleSave() {
        const trimmed = draft.trim();
        if (trimmed !== (value ?? '')) onCommit(trimmed);
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-12-regular text-fg-secondary hover:bg-bg-soft"
                aria-label="Редактировать комментарий"
            >
                <Pencil className="size-3 shrink-0 text-fg-tertiary" />
                <span className="truncate">{value || '—'}</span>
            </button>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Комментарий</DialogTitle>
                </DialogHeader>
                <Textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Введите комментарий…"
                    className="min-h-[160px] resize-y"
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Отмена
                    </Button>
                    <Button onClick={handleSave}>Сохранить</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ItemsTableRow({
    item,
    derived,
    selected,
    onToggleSelect,
    onEdit,
    onPublish,
    onDelete,
    onCommit,
    onRegenerate,
}: ItemsTableRowProps) {
    const {
        shortName,
        published,
        packPriceRub,
        packPriceWithOrgFeeRub,
        unitPriceRub,
        collectedQty,
        remainderQty,
        orgFeePercent,
        isDone,
        isActive,
    } = derived;

    const unit = item.packUnit ?? item.minPackageUnit ?? shortName;

    // Все валюты из справочника — Select всегда активен. Если у выбранной
    // валюты нет курса, производные колонки ₽ (4/5/6) покажут «—».
    const { data: allCurrencies } = trpc.currencies.list.useQuery();
    const currencies = allCurrencies ?? [];

    return (
        <TableRow
            className="group hover:bg-bg-soft"
            data-published={published || undefined}
            data-hidden={item.hidden || undefined}
        >
            {/* 1. Товар (sticky left) — opaque bg, без group-hover, чтобы не
                просвечивал контент при горизонтальном скролле. У скрытых приглушаем
                только содержимое, а не фон — иначе при скролле просвечивают соседние колонки. */}
            <TableCell className="sticky left-0 z-10 overflow-hidden bg-bg-card">
                <div className={cn('flex items-center gap-2', item.hidden && 'opacity-50')}>
                    <ProductPhotoPreview
                        photoId={item.product.photos?.[0]?.id}
                        alt={item.product.name}
                        thumbClassName="size-7 shrink-0 rounded-md"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                            <TruncatedText
                                fullText={item.product.name ?? ''}
                                className="text-13-medium text-fg-primary"
                            >
                                {item.product.name}
                            </TruncatedText>
                            {item.hidden && (
                                <EyeOff className="size-3 shrink-0 text-fg-tertiary" />
                            )}
                        </div>
                        {item.supplier && (
                            <TruncatedText
                                fullText={item.supplier.name}
                                className="text-11-regular text-fg-tertiary"
                            >
                                {item.supplier.name}
                            </TruncatedText>
                        )}
                    </div>
                </div>
            </TableCell>

            {/* 2. В упаковке (вес пачки) — packAmount (число) + packUnit (Select из registry) */}
            <TableCell className="px-2 py-1 text-right">
                <div className="flex items-center justify-end gap-1">
                    <InlineCell
                        value={item.packAmount}
                        onCommit={(v) => onCommit({ packAmount: v })}
                        onClear={() => onCommit({ packAmount: 0 })}
                        min={0}
                        ariaLabel="Вес упаковки"
                        align="right"
                        className="w-14"
                    />
                    <PackageUnitSelect
                        value={item.packUnit ?? unit ?? 'гр'}
                        onChange={(v) => onCommit({ packUnit: v })}
                        className="h-7"
                    />
                </div>
            </TableCell>

            {/* 3. Цена за упаковку в валюте + Select валюты (все валюты справочника) */}
            <TableCell className="px-2 py-1 text-right">
                <div className="flex items-center justify-end gap-1">
                    <InlineCell
                        value={item.pricePerPackCurrency}
                        onCommit={(v) => onCommit({ pricePerPackCurrency: v })}
                        onClear={() => onCommit({ pricePerPackCurrency: 0 })}
                        min={0}
                        ariaLabel="Цена за упаковку в валюте"
                        align="right"
                        className="w-16 shrink-0"
                    />
                    <Select
                        value={item.currencyId != null ? String(item.currencyId) : 'none'}
                        onValueChange={(v) => {
                            if (v === 'none') {
                                onCommit({ currencyId: null });
                            } else {
                                onCommit({ currencyId: Number(v) });
                            }
                        }}
                    >
                        <SelectTrigger
                            size="sm"
                            aria-label="Валюта цены"
                            className="h-7 w-[76px] shrink-0 rounded-md border-border bg-bg-card px-1.5 text-11-medium text-fg-primary shadow-xs hover:border-ring"
                        >
                            <span className="truncate">
                                {item.currency?.name ?? '—'}
                            </span>
                        </SelectTrigger>
                        <SelectContent align="end" position="popper" className="min-w-[8rem]">
                            <SelectItem value="none">—</SelectItem>
                            {currencies.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </TableCell>

            {/* 4. Цена за упаковку в ₽ (derived) */}
            <TableCell className="px-3 text-right text-13-medium tabular-nums">
                {formatRubPrice(packPriceRub)}
            </TableCell>

            {/* 5. Цена за уп. в ₽ + оргсбор (read-only, оргсбор правится в модалке) */}
            <TableCell className="px-3 text-right">
                <div className="flex flex-col items-end">
                    <span className="text-13-medium tabular-nums">
                        {formatRubPrice(packPriceWithOrgFeeRub)}
                    </span>
                    <span className="text-11-regular text-fg-tertiary">+{orgFeePercent}%</span>
                </div>
            </TableCell>

            {/* 6. Цена за 1ед в ₽ (derived) */}
            <TableCell className="px-3 text-right">
                <span className="text-14-semibold tabular-nums text-fg-primary">
                    {formatRubPrice(unitPriceRub)}
                    {unitPriceRub != null && (
                        <span className="ml-1 text-11-regular text-fg-tertiary">
                            /{unit || 'ед'}
                        </span>
                    )}
                </span>
            </TableCell>

            {/* 7. Собрано (авто из заказов, derived) */}
            <TableCell className="px-3 text-right text-13-medium tabular-nums text-fg-secondary">
                {numOrDash(collectedQty)}
                <span className="ml-1 text-11-regular text-fg-tertiary">{unit || 'ед'}</span>
            </TableCell>

            {/* 8. Заказано (inline) */}
            <TableCell className="px-2 py-1 text-right">
                <InlineCell
                    value={item.orderedQty ?? 0}
                    onCommit={(v) => onCommit({ orderedQty: v })}
                    onClear={() => onCommit({ orderedQty: null })}
                    allowNegative
                    ariaLabel="Заказано"
                    align="right"
                    className="w-full"
                />
            </TableCell>

            {/* 9. Скомплектовано (inline) */}
            <TableCell className="px-2 py-1 text-right">
                <InlineCell
                    value={item.assembledQty ?? 0}
                    onCommit={(v) => onCommit({ assembledQty: v })}
                    onClear={() => onCommit({ assembledQty: null })}
                    allowNegative
                    ariaLabel="Скомплектовано"
                    align="right"
                    className="w-full"
                />
            </TableCell>

            {/* 10. Дозаказано у др. поставщика (inline) */}
            <TableCell className="px-2 py-1 text-right">
                <InlineCell
                    value={item.reorderedQty ?? 0}
                    onCommit={(v) => onCommit({ reorderedQty: v })}
                    onClear={() => onCommit({ reorderedQty: null })}
                    allowNegative
                    ariaLabel="Дозаказано"
                    align="right"
                    className="w-full"
                />
            </TableCell>

            {/* 11. Остаток на пристрой (derived) */}
            <TableCell className="px-3 text-right">
                {remainderQty == null ? (
                    <span className="text-13-medium text-fg-tertiary">—</span>
                ) : (
                    <span
                        className={
                            remainderQty > 0
                                ? 'text-13-medium tabular-nums text-warning'
                                : remainderQty < 0
                                  ? 'text-13-medium tabular-nums text-error'
                                  : 'text-13-medium tabular-nums text-fg-tertiary'
                        }
                    >
                        {numOrDash(remainderQty)}
                    </span>
                )}
            </TableCell>

            {/* 12. Комментарий — кнопка с иконкой, открывает диалог с Textarea */}
            <TableCell className="px-3 py-1">
                <CommentCell
                    value={item.adminComment}
                    onCommit={(v) => onCommit({ adminComment: v })}
                />
            </TableCell>

            {/* TG-чекбокс */}
            <TableCell className="px-2 text-center">
                {published ? (
                    <Checkbox checked disabled aria-label="Опубликовано в Telegram" />
                ) : (
                    <Checkbox
                        checked={selected}
                        disabled={isDone || item.hidden}
                        aria-label="Выбрать для публикации в Telegram"
                        onCheckedChange={(v) => {
                            if (typeof v === 'boolean') onToggleSelect(item.id, v);
                        }}
                    />
                )}
            </TableCell>

            {/* Действия (sticky right) — opaque bg, без group-hover */}
            <TableCell className="sticky right-0 z-10 bg-bg-card">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Действия"
                            className="size-8 rounded-full text-fg-secondary opacity-60 group-hover:opacity-100 data-[state=open]:opacity-100"
                        >
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-48">
                        <DropdownMenuItem onClick={() => onEdit(item.id)}>
                            Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onCommit({ hidden: !item.hidden })}
                        >
                            <EyeOff className="size-3.5" />
                            {item.hidden ? 'Показать' : 'Скрыть'}
                        </DropdownMenuItem>
                        {!published && isActive && !item.hidden && (
                            <DropdownMenuItem onClick={() => onPublish(item.id)}>
                                <Send className="size-3.5" /> Опубликовать в TG
                            </DropdownMenuItem>
                        )}
                        {published && onRegenerate && (
                            <DropdownMenuItem onClick={() => onRegenerate({ itemId: item.id })}>
                                <RefreshCw className="size-3.5" /> Обновить пост в TG
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() =>
                                onDelete({
                                    id: item.id,
                                    product: item.product,
                                    orderCount: item.orderLines.filter(
                                        (l) => l.status !== 'CANCELLED',
                                    ).length,
                                    published,
                                })
                            }
                            className="text-error focus:text-error"
                        >
                            <Trash2 className="size-3.5" /> Удалить
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}
