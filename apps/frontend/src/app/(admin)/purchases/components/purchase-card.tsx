'use client';

import { AppLink } from '@/components/app-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_VARIANT } from '../../lib/constants';

interface AdminPurchaseListCardProps {
    purchase: {
        id: number;
        tag: string;
        supplier: string;
        status: string;
        deadline: string;
        items: { orderLines: { amountDue: unknown }[] }[];
    };
}

export function PurchaseCard({ purchase }: AdminPurchaseListCardProps) {
    const deadline = new Date(purchase.deadline);
    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const totalOrders = purchase.items.reduce((sum, item) => sum + item.orderLines.length, 0);
    const totalAmount = purchase.items.reduce(
        (sum, item) => sum + item.orderLines.reduce((s, ol) => s + Number(ol.amountDue), 0),
        0,
    );

    return (
        <AppLink href={`/purchases/${purchase.id}`}>
            <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{purchase.tag}</CardTitle>
                        <Badge variant={STATUS_VARIANT[purchase.status] ?? 'secondary'}>
                            {STATUS_LABELS[purchase.status] ?? purchase.status}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="font-medium">{purchase.supplier}</p>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>До {deadline.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                        {purchase.status === 'ACTIVE' && (
                            <span className={daysLeft <= 3 ? 'text-destructive font-medium' : ''}>
                                {daysLeft > 0 ? `${daysLeft} дн.` : 'Просрочено'}
                            </span>
                        )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-sm">
                        <span>{purchase.items.length} товаров</span>
                        <span>{totalOrders} заказов</span>
                        <span className="font-medium">{totalAmount.toLocaleString('ru-RU')} ₽</span>
                    </div>
                </CardContent>
            </Card>
        </AppLink>
    );
}
