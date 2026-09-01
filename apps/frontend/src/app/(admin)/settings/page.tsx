'use client';

import { Coins,FileText, Layers, ListChecks, Percent, Settings, Tag, Truck } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { CharacteristicsTab } from './characteristics/characteristics-tab';
import { CurrenciesTab } from './currencies/currencies-tab';
import { PostTemplatesTab } from './post-templates/post-templates-tab';
import { ProductAttributesTab } from './product-attributes/product-attributes-tab';
import { PromoCodesTab } from './promo-codes/promo-codes-tab';
import { PurchasePricingTab } from './purchase-pricing/purchase-pricing-tab';
import { SuppliersTab } from './suppliers/suppliers-tab';

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
                <TabsList className="!h-fit w-full max-w-full flex-nowrap justify-start gap-1 overflow-x-auto overflow-y-hidden p-1 sm:w-fit">
                    <TabsTrigger value="attributes" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Layers className="size-4 shrink-0" />
                        <span className="hidden lg:inline">Справочники товаров</span>
                        <span className="hidden sm:inline lg:hidden">Справочники</span>
                        <span className="sm:hidden">Справ.</span>
                    </TabsTrigger>
                    <TabsTrigger value="characteristics" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <ListChecks className="size-4 shrink-0" />
                        <span className="hidden sm:inline">Характеристики</span>
                        <span className="sm:hidden">Хар-ки</span>
                    </TabsTrigger>
                    <TabsTrigger value="suppliers" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Truck className="size-4 shrink-0" />
                        <span className="hidden sm:inline">Поставщики</span>
                        <span className="sm:hidden">Пост.</span>
                    </TabsTrigger>
                    <TabsTrigger value="currencies" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Coins className="size-4 shrink-0" />
                        <span className="hidden sm:inline">Валюты</span>
                        <span className="sm:hidden">Вал.</span>
                    </TabsTrigger>
                    <TabsTrigger value="templates" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <FileText className="size-4 shrink-0" />
                        <span className="hidden sm:inline">Шаблоны постов</span>
                        <span className="sm:hidden">Шаблоны</span>
                    </TabsTrigger>
                    <TabsTrigger value="promocodes" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Tag className="size-4 shrink-0" />
                        <span className="hidden sm:inline">Промокоды</span>
                        <span className="sm:hidden">Промо</span>
                    </TabsTrigger>
                    <TabsTrigger value="pricing" className="shrink-0 flex-none gap-1.5 px-2.5 py-2 sm:px-3">
                        <Percent className="size-4 shrink-0" />
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
                <TabsContent value="suppliers" className="mt-0">
                    <SuppliersTab />
                </TabsContent>
                <TabsContent value="currencies" className="mt-0">
                    <CurrenciesTab />
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
