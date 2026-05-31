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
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Settings className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Настройки</h1>
                    <p className="text-sm text-muted-foreground">
                        <span className="hidden sm:inline">
                            Управление характеристиками, поставщиками, промокодами и другими параметрами
                        </span>
                        <span className="sm:hidden">Справочники и параметры системы</span>
                    </p>
                </div>
            </div>

            <Tabs defaultValue="attributes" className="gap-4">
                <TabsList className="h-auto w-full max-w-full flex-nowrap justify-start gap-1 overflow-x-auto p-1 sm:w-fit">
                    <TabsTrigger value="attributes" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Layers className="h-4 w-4 shrink-0" />
                        <span className="hidden lg:inline">Справочники товаров</span>
                        <span className="hidden sm:inline lg:hidden">Справочники</span>
                        <span className="sm:hidden">Справ.</span>
                    </TabsTrigger>
                    <TabsTrigger value="characteristics" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <ListChecks className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Характеристики</span>
                        <span className="sm:hidden">Хар-ки</span>
                    </TabsTrigger>
                    <TabsTrigger value="units" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Scale className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Единицы учёта</span>
                        <span className="sm:hidden">Единицы</span>
                    </TabsTrigger>
                    <TabsTrigger value="suppliers" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Truck className="h-4 w-4 shrink-0" />
                        Поставщики
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Шаблоны постов</span>
                        <span className="sm:hidden">Шаблоны</span>
                    </TabsTrigger>
                    <TabsTrigger value="promocodes" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Tag className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Промокоды</span>
                        <span className="sm:hidden">Промо</span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="attributes" className="mt-0">
                    <ProductAttributesTab />
                </TabsContent>
                <TabsContent value="characteristics" className="mt-0">
                    <CharacteristicsTab />
                </TabsContent>
                <TabsContent value="units" className="mt-0">
                    <UnitsTab />
                </TabsContent>
                <TabsContent value="suppliers" className="mt-0">
                    <SuppliersTab />
                </TabsContent>
                <TabsContent value="templates" className="mt-0">
                    <PostTemplatesTab />
                </TabsContent>
                <TabsContent value="promocodes" className="mt-0">
                    <PromoCodesTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
