'use client';

import { CircleCheck, CircleX, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatRub } from '@/lib/format/money';
import { cn } from '@/lib/utils';

import { useTogglePromoCode } from '../hooks';
import { getPromoStatus } from '../lib';
export interface PromoCodeData {
    id: number;
    code: string;
    label: string | null;
    type: 'PERCENT' | 'FIXED';
    value: string | number;
    purchase: unknown;
    usedCount: number;
    maxUses: number | null;
    minAmount: string | null;
    expiresAt: string | null;
    isActive: boolean;
}

interface PromoCodeRowProps {
    promo: PromoCodeData;
    onDelete: (promo: { id: number; code: string }) => void;
}

export function PromoCodeRow({ promo, onDelete }: PromoCodeRowProps) {
    const toggleMutation = useTogglePromoCode();
    const purchase = promo.purchase as any;
    const status = getPromoStatus(promo);

    return (
        <TableRow key={promo.id}>
            <TableCell>
                <code className="rounded bg-bg-soft px-2 py-0.5 font-mono text-14-semibold">{promo.code}</code>
            </TableCell>
            <TableCell className="text-14-regular text-fg-secondary">{promo.label || '—'}</TableCell>
            <TableCell>
                <Badge variant="outline">{promo.type === 'PERCENT' ? 'Процент' : 'Фикс. сумма'}</Badge>
            </TableCell>
            <TableCell className="text-14-semibold">
                {promo.type === 'PERCENT' ? `${Number(promo.value)}%` : `${formatRub(Number(promo.value))}`}
            </TableCell>
            <TableCell className="text-14-regular">{purchase ? `${purchase.tag}` : 'Любая'}</TableCell>
            <TableCell className="text-center text-14-regular">
                {promo.usedCount}
                {promo.maxUses ? `/${promo.maxUses}` : ''}
            </TableCell>
            <TableCell className="text-14-regular">{promo.minAmount ? `${formatRub(Number(promo.minAmount))}` : '—'}</TableCell>
            <TableCell className="text-14-regular">
                {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString('ru-RU') : 'Бессрочно'}
            </TableCell>
            <TableCell className="text-center">
                <Badge className={status.className}>{status.label}</Badge>
            </TableCell>
            <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'size-8 p-0',
                            promo.isActive ? 'text-error hover:bg-error-50' : 'text-success hover:bg-success-50',
                        )}
                        onClick={() => toggleMutation.mutate({ id: promo.id, isActive: !promo.isActive })}
                        disabled={toggleMutation.isPending}
                    >
                        {promo.isActive ? <CircleX className="size-4" /> : <CircleCheck className="size-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="size-8 p-0 text-error hover:text-error"
                        onClick={() => onDelete({ id: promo.id, code: promo.code })}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}
