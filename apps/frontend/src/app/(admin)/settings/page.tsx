'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, ListChecks, Tag, Layers, FileText, Truck, Scale } from 'lucide-react';
import { CharacteristicsTab } from './characteristics/characteristics-tab';
import { PostTemplatesTab } from './post-templates/post-templates-tab';
import { PromoCodesTab } from './promo-codes/promo-codes-tab';
import { ProductAttributesTab } from './product-attributes/product-attributes-tab';
import { SuppliersTab } from './suppliers/suppliers-tab';
import { UnitsTab } from './units/units-tab';

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Settings className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
                    <p className="text-sm text-muted-foreground">
                        Управление характеристиками, поставщиками, промокодами и другими параметрами
                    </p>
                </div>
            </div>

            <Tabs defaultValue="attributes">
                <TabsList>
                    <TabsTrigger value="attributes">
                        <Layers className="h-4 w-4" />
                        Справочники товаров
                    </TabsTrigger>
                    <TabsTrigger value="characteristics">
                        <ListChecks className="h-4 w-4" />
                        Характеристики
                    </TabsTrigger>
                    <TabsTrigger value="units">
                        <Scale className="h-4 w-4" />
                        Единицы учёта
                    </TabsTrigger>
                    <TabsTrigger value="suppliers">
                        <Truck className="h-4 w-4" />
                        Поставщики
                    </TabsTrigger>
                    <TabsTrigger value="templates">
                        <FileText className="h-4 w-4" />
                        Шаблоны постов
                    </TabsTrigger>
                    <TabsTrigger value="promocodes">
                        <Tag className="h-4 w-4" />
                        Промокоды
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="attributes">
                    <ProductAttributesTab />
                </TabsContent>
                <TabsContent value="characteristics">
                    <CharacteristicsTab />
                </TabsContent>
                <TabsContent value="units">
                    <UnitsTab />
                </TabsContent>
                <TabsContent value="suppliers">
                    <SuppliersTab />
                </TabsContent>
                <TabsContent value="templates">
                    <PostTemplatesTab />
                </TabsContent>
                <TabsContent value="promocodes">
                    <PromoCodesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
