'use client';

import { isWeightUnit } from '@zakupki/types';
import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ProductPhotoPreview } from '@/components/shared/product-photo-preview';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ProductLabelSource } from '@/lib/product-label';
import { cn } from '@/lib/utils';

// ── helpers ──────────────────────────────────────────────────────────

/** «1,5» → 1.5; пусто/нечисло → null. */
function parseQty(raw: string): number | null {
    const t = raw.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
}

/**
 * Минимальная форма позиции закупки для ручного редактирования:
 * id + продукт (для подписи и шага ±). Структурная — совместима с тем,
 * что возвращает trpc.purchases.getById (pricePerUnit там строка, поэтому
 * строгий PurchaseItem из lib/types не подходит).
 */
export interface PurchaseItemOption {
    id: number;
    // minPackageAmount/minPackageUnit живут на PurchaseItem (не Product —
    // после миграции 20260705154536 поля на Product удалены).
    minPackageAmount?: string | number | null;
    /** Вес упаковки поставщика в базовых единицах (гр/шт). */
    packAmount?: string | number | null;
    /** Единица веса упаковки. */
    packUnit?: string | null;
    /** Снапшот единицы позиции (гр/шт/туба); фолбэк — product.unitCode. */
    unitCode?: string | null;
    product: ProductLabelSource & {
        unitCode?: string | null;
        multiplicity?: string | number | null;
        photos?: { id: number }[];
    };
    supplier?: { id: number; name: string } | null;
}

// ── AdminOrderLineEditor: − / поле / + / корзина для одной позиции ───

interface AdminOrderLineEditorProps {
    purchaseItemId: number;
    /** Название товара — для диалога подтверждения удаления. */
    productName: string;
    quantity: number;
    step: number;
    pending: boolean;
    onAdjust: (purchaseItemId: number, delta: number) => void;
    onSetQuantity: (purchaseItemId: number, qty: number) => void;
    /** Удаление товара целиком (все строки участника на этот purchaseItem). */
    onDelete: (purchaseItemId: number, productName: string) => void;
    /** Кол-во целых упаковок (для опц. блока ±уп). */
    packageCount?: number;
    /** Вес упаковки в базовых единицах. null — упаковок нет, блок скрыт. */
    packAmount?: string | number | null;
    /** Код единицы товара: блок ±уп только для весовых (гр). */
    unitCode?: string | null;
    /** ± на кол-во упаковок (admin-override). */
    onAdjustPackage?: (purchaseItemId: number, delta: number) => void;
}

/**
 * Inline-редактор количества позиции участника. Действия идут в обход
 * бизнес-логики (серверный OrderService.admin*). amountDue пересчитывается
 * на сервере; локальное поле хранит только qty, коммитится по blur/Enter.
 *
 * Опциональный блок ±уп показывается только для товаров с packAmount —
 * упаковки живут на COLLECTION-строке и меняются отдельным admin-override.
 */
export function AdminOrderLineEditor({
    purchaseItemId,
    productName,
    quantity,
    step,
    pending,
    onAdjust,
    onSetQuantity,
    onDelete,
    packageCount = 0,
    packAmount,
    unitCode,
    onAdjustPackage,
}: AdminOrderLineEditorProps) {
    const [value, setValue] = useState(String(quantity));
    const focused = useRef(false);

    // После успешной мутации (рефетч) синхронизируем поле, если юзер не вводит.
    useEffect(() => {
        if (!focused.current) setValue(String(quantity));
    }, [quantity]);

    const commit = () => {
        const parsed = parseQty(value);
        if (parsed == null) {
            setValue(String(quantity));
            return;
        }
        if (parsed !== quantity) onSetQuantity(purchaseItemId, parsed);
    };

    const hasPackages =
        isWeightUnit(unitCode ?? null) &&
        packAmount != null &&
        Number(packAmount) > 0 &&
        Number.isFinite(Number(packAmount)) &&
        onAdjustPackage != null;

    return (
        <div className="flex items-center gap-2">
            {/* Колонка контролов: россыпь, при hasPackages — упаковки под ней. */}
            <div className={hasPackages ? 'flex flex-col gap-1' : 'flex items-center gap-1'}>
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon-xs"
                        disabled={pending}
                        aria-label="Убавить"
                        onClick={() => onAdjust(purchaseItemId, -step)}
                    >
                        <Minus />
                    </Button>
                    <Input
                        inputMode="decimal"
                        value={value}
                        disabled={pending}
                        onFocus={() => {
                            focused.current = true;
                        }}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={() => {
                            focused.current = false;
                            commit();
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                        }}
                        className="h-7 w-16 text-center tabular-nums"
                        aria-label="Количество"
                    />
                    <Button
                        variant="outline"
                        size="icon-xs"
                        disabled={pending}
                        aria-label="Добавить"
                        onClick={() => onAdjust(purchaseItemId, step)}
                    >
                        <Plus />
                    </Button>
                </div>
                {hasPackages && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="icon-xs"
                            disabled={pending || packageCount <= 0}
                            aria-label="Убавить упаковку"
                            onClick={() => onAdjustPackage!(purchaseItemId, -1)}
                        >
                            <Minus />
                        </Button>
                        <Input
                            readOnly
                            value={`${packageCount} уп`}
                            tabIndex={-1}
                            aria-label="Целые упаковки"
                            className="h-7 w-16 cursor-default text-center text-12-semibold tabular-nums text-fg-secondary"
                        />
                        <Button
                            variant="outline"
                            size="icon-xs"
                            disabled={pending}
                            aria-label="Добавить упаковку"
                            onClick={() => onAdjustPackage!(purchaseItemId, 1)}
                        >
                            <Plus />
                        </Button>
                    </div>
                )}
            </div>
            <Button
                variant="ghost"
                size="icon-xs"
                disabled={pending}
                aria-label="Удалить позицию"
                onClick={() => onDelete(purchaseItemId, productName)}
                className="text-fg-tertiary hover:text-error"
            >
                <Trash2 />
            </Button>
        </div>
    );
}

// ── AddPositionDialog: добавить новую позицию участнику ──────────────

interface AddPositionDialogProps {
    purchaseItems: PurchaseItemOption[];
    pending: boolean;
    onAdd: (purchaseItemId: number, qty: number) => void;
}

/** Карточка варианта товара в списке выбора. */
function PositionOption({
    item,
    selected,
    onSelect,
}: {
    item: PurchaseItemOption;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors',
                selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-bg-soft',
            )}
        >
            <ProductPhotoPreview
                photoId={item.product.photos?.[0]?.id}
                alt={item.product.name}
                thumbClassName="h-11 w-11 rounded-md"
            />
            <div className="min-w-0 flex-1">
                <PurchaseProductLabel
                    product={item.product}
                    primaryClassName="block truncate text-13-medium text-fg-primary"
                    secondaryClassName="block truncate text-12-regular text-fg-tertiary"
                />
                {item.supplier && (
                    <p className="mt-0.5 block truncate text-12-regular text-fg-tertiary" title={item.supplier.name}>
                        {item.supplier.name}
                    </p>
                )}
            </div>
            {selected && <Check className="size-4 shrink-0 text-secondary" />}
        </button>
    );
}

/**
 * Диалог выбора товара из закупки и количества → adminAdd (создаст
 * COLLECTION-строку, если у участника её ещё нет).
 */
export function AddPositionDialog({ purchaseItems, pending, onAdd }: AddPositionDialogProps) {
    const [open, setOpen] = useState(false);
    const [itemId, setItemId] = useState<string | null>(null);
    const [qtyStr, setQtyStr] = useState('');

    const reset = () => {
        setItemId(null);
        setQtyStr('');
    };

    const submit = () => {
        const id = Number(itemId);
        const qty = parseQty(qtyStr);
        if (!Number.isFinite(id) || qty == null || qty <= 0) return;
        onAdd(id, qty);
        setOpen(false);
        reset();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) reset();
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Plus />
                    Добавить позицию
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Добавить позицию участнику</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="max-h-80 space-y-1 overflow-y-auto">
                        {purchaseItems.map((item) => (
                            <PositionOption
                                key={item.id}
                                item={item}
                                selected={itemId === String(item.id)}
                                onSelect={() => setItemId(String(item.id))}
                            />
                        ))}
                    </div>
                    <Input
                        inputMode="decimal"
                        placeholder="Количество"
                        value={qtyStr}
                        onChange={(e) => setQtyStr(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') submit();
                        }}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Отмена</Button>
                    </DialogClose>
                    <Button onClick={submit} disabled={pending || !itemId || !qtyStr}>
                        Добавить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
