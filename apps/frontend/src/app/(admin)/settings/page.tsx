'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Ruler, Tag } from 'lucide-react';
import { UnitsTab } from './units/units-tab';
import { PromoCodesTab } from './promo-codes/promo-codes-tab';

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Settings className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
                    <p className="text-sm text-muted-foreground">Управление единицами, промокодами и другими параметрами</p>
                </div>
            </div>

            <Tabs defaultValue="units">
                <TabsList>
                    <TabsTrigger value="units">
                        <Ruler className="h-4 w-4" />
                        Единицы
                    </TabsTrigger>
                    <TabsTrigger value="promocodes">
                        <Tag className="h-4 w-4" />
                        Промокоды
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="units">
                    <UnitsTab />
                </TabsContent>
                <TabsContent value="promocodes">
                    <PromoCodesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
