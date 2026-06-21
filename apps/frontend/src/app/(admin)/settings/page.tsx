'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, ListChecks, Tag, Layers, FileText, Percent } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { PurchasePricingTab } from './purchase-pricing/purchase-pricing-tab';
import { CharacteristicsTab } from './characteristics/characteristics-tab';
import { PostTemplatesTab } from './post-templates/post-templates-tab';
import { PromoCodesTab } from './promo-codes/promo-codes-tab';
import { ProductAttributesTab } from './product-attributes/product-attributes-tab';

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <PageHeader
                variant="with-icon"
                icon={<Settings className="size-5" />}
                title="Настройки"
                description="Управление характеристиками, промокодами и другими параметрами"
                descriptionMobile="Справочники и параметры системы"
            />

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
                    <TabsTrigger value="pricing" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Percent className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Цены закупок</span>
                        <span className="sm:hidden">Цены</span>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="attributes" className="mt-0">
                    <ProductAttributesTab />
                </TabsContent>
                <TabsContent value="characteristics" className="mt-0">
                    <CharacteristicsTab />
                </TabsContent>
                <TabsContent value="templates" className="mt-0">
                    <PostTemplatesTab />
                </TabsContent>
                <TabsContent value="promocodes" className="mt-0">
                    <PromoCodesTab />
                </TabsContent>
                <TabsContent value="pricing" className="mt-0">
                    <PurchasePricingTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
