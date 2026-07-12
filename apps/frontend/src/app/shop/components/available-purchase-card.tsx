'use client';

import { AppLink } from '@/components/app-link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Users, ArrowRight } from 'lucide-react';

import type { AvailablePurchaseCardProps } from '../lib/types';

export function AvailablePurchaseCard({ purchase }: AvailablePurchaseCardProps) {
    const totalOrders = purchase.items.reduce((sum, item) => sum + item.orderLines.length, 0);

    return (
        <AppLink href={`/shop/purchase/${purchase.id}`}>
            <Card className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
                <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                         <div>
                            <Badge
                                className={
                                    (purchase as { fulfillmentStatus?: string }).fulfillmentStatus === 'REORDER'
                                        ? 'bg-warning-50 text-warning hover:bg-warning-50'
                                        : 'bg-success-50 text-success hover:bg-success-50'
                                }
                            >
                                {(purchase as { fulfillmentStatus?: string }).fulfillmentStatus === 'REORDER'
                                    ? 'Добор'
                                    : 'Активна'}
                            </Badge>
                            <h3 className="mt-2 text-lg font-semibold group-hover:text-primary transition-colors">
                                {purchase.tag}
                            </h3>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Package className="h-3.5 w-3.5 text-info" />
                            <span>{purchase.items.length} тов.</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5 text-success" />
                            <span>{totalOrders} заказов</span>
                        </div>
                    </div>

                    <Button variant="default" className="mt-4 w-full">
                        Участвовать
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        </AppLink>
    );
}
