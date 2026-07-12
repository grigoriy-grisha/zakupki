'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';

import { usePurchaseProductLabelText } from '@/components/shared/purchase-product-label';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProductLabelSource } from '../../../../products/lib';

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
    product: ProductLabelSource & {
        minPackageAmount?: string | number | null;
        unit?: { shortName: string } | null;
    };
    supplier?: { id: number; name: string } | null;
}

// ── AdminOrderLineEditor: − / поле / + / корзина для одной позиции ───

interface AdminOrderLineEditorProps {
    orderId: number;
    purchaseItemId: number;
    /** Название товара — для диалога подтверждения удаления. */
    productName: string;
    quantity: number;
    step: number;
    pending: boolean;
    onAdjust: (purchaseItemId: number, delta: number) => void;
    onSetQuantity: (purchaseItemId: number, qty: number) => void;
    onDelete: (orderId: number, productName: string) => void;
}

/**
 * Inline-редактор количества позиции участника. Действия идут в обход
 * бизнес-логики (серверный OrderService.admin*). amountDue пересчитывается
 * на сервере; локальное поле хранит только qty, коммитится по blur/Enter.
 */
export function AdminOrderLineEditor({
    orderId,
    purchaseItemId,
    productName,
    quantity,
    step,
    pending,
    onAdjust,
    onSetQuantity,
    onDelete,
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

    return (
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
            <Button
                variant="ghost"
                size="icon-xs"
                disabled={pending}
                aria-label="Удалить позицию"
                onClick={() => onDelete(orderId, productName)}
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

/** Текстовая подпись товара (для SelectItem). */
function PositionItemLabel({
    product,
    supplier,
}: {
    product: ProductLabelSource;
    supplier?: { name: string } | null;
}) {
    const text = usePurchaseProductLabelText(product);
    return (
        <>
            {text}
            {supplier ? <span className="text-fg-tertiary"> · {supplier.name}</span> : null}
        </>
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
                    <Select value={itemId ?? undefined} onValueChange={setItemId}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Выберите товар из закупки" />
                        </SelectTrigger>
                        <SelectContent>
                            {purchaseItems.map((item) => (
                                <SelectItem key={item.id} value={String(item.id)}>
                                    <PositionItemLabel product={item.product} supplier={item.supplier} />
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
