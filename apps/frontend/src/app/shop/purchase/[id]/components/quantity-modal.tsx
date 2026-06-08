'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { isSupplementPhase } from '@zakupki/types';
import { PurchaseProductLabel } from '@/components/shared/purchase-product-label';
import { QuantityButtons } from '@/app/shop/components/quantity-buttons';
import { useItemOrderControls } from '@/app/shop/hooks/use-item-order-controls';
import type { ShopPurchaseItem } from '@/app/shop/lib/types';

interface QuantityModalProps {
    purchaseItemId: number;
    purchaseId: number;
    packDiscountPercent: number;
    fulfillmentStatus: string;
    /** Текущее количество этого пользователя (0 если заказа не было). */
    currentQuantity: number;
    /** Количество упаковок поставщика у этого пользователя. */
    packageCount?: number;
    /** baseQuantity — зафиксированное количество при входе в SUPPLEMENT/REORDER. */
    baseQuantity?: number;
    /** Полные данные PurchaseItem. */
    item: ShopPurchaseItem;
    onClose: () => void;
}

export function QuantityModal({
    purchaseItemId,
    purchaseId,
    packDiscountPercent,
    fulfillmentStatus,
    currentQuantity,
    packageCount = 0,
    baseQuantity = 0,
    item,
    onClose,
}: QuantityModalProps) {
    const ctx = useItemOrderControls({
        purchaseId,
        purchaseItemId,
        item,
        currentQuantity,
        currentPackageCount: packageCount,
        baseQuantity,
        fulfillmentStatus,
        packDiscountPercent,
    });

    const isSupplement = isSupplementPhase(fulfillmentStatus);
    const remainingPool =
        ctx.availablePool != null && ctx.availablePool < Number.POSITIVE_INFINITY
            ? Math.max(0, ctx.availablePool)
            : null;

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="pr-6 text-left">
                        <PurchaseProductLabel product={item.product} primaryClassName="text-lg font-semibold" />
                    </DialogTitle>
                    <DialogDescription className="text-left">
                        {ctx.price.toLocaleString('ru-RU')} ₽/{ctx.shortName}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Пул добора */}
                    {isSupplement && remainingPool != null && (
                        <div
                            className={`rounded-lg p-3 text-center text-sm ${
                                remainingPool <= 0 ? 'bg-error-50 text-error' : 'bg-warning-50 text-warning'
                            }`}
                        >
                            {remainingPool > 0 ? (
                                <>
                                    Доступно ещё:{' '}
                                    <strong>
                                        {remainingPool} {ctx.shortName}
                                    </strong>
                                </>
                            ) : (
                                <strong>Весь остаток выбран</strong>
                            )}
                        </div>
                    )}

                    {/* Количество */}
                    <div className="space-y-4">
                        <div className="text-center">
                            <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                                {currentQuantity % 1 === 0
                                    ? currentQuantity
                                    : currentQuantity.toFixed(3).replace(/\.?0+$/, '')}
                            </span>
                            <span className="ml-2 text-lg font-medium text-muted-foreground">{ctx.shortName}</span>
                        </div>

                        <QuantityButtons
                            activeStep={ctx.activeStep}
                            shortName={ctx.shortName}
                            canAdd={ctx.canAdd}
                            canDecrease={ctx.canDecrease}
                            onAdd={ctx.handleAdd}
                            onRemove={ctx.handleRemove}
                            isPending={ctx.isPending}
                            showPackage={ctx.showPackageButtons}
                            packSize={ctx.packSize}
                            packageCount={ctx.currentPackageCount}
                            onAddPackage={ctx.handleAddPackage}
                            onRemovePackage={ctx.handleRemovePackage}
                            size="md"
                        />
                    </div>

                    {/* Итого */}
                    <div className="rounded-xl bg-primary/5 p-4 text-center">
                        <p className="text-sm text-muted-foreground">Итого</p>
                        <p className="mt-1 text-2xl font-bold text-primary sm:text-3xl">
                            {ctx.total.toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {currentQuantity > 0 && `${currentQuantity} ${ctx.shortName}`}
                            {currentQuantity > 0 && packageCount > 0 && ' + '}
                            {packageCount > 0 && `${packageCount} упак.`} · {ctx.total.toLocaleString('ru-RU')} ₽
                        </p>
                        {ctx.fullPacks > 0 && (
                            <p className="mt-2 text-xs text-success">
                                Скидка за {ctx.fullPacks} {ctx.fullPacks === 1 ? 'целую пачку' : 'целые пачки'}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                        Закрыть
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
