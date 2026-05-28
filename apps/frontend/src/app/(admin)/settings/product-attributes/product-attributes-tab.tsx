'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PRODUCT_ATTRIBUTE_KIND_LABELS, type ProductAttributeKind } from '@/app/(admin)/products/lib/schema';
import { AttributeKindPanel } from './components/attribute-kind-panel';

const KINDS: ProductAttributeKind[] = ['MANUFACTURER', 'SIZE', 'FORM', 'PRODUCT_LINE'];

export function ProductAttributesTab() {
    return (
        <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
                Справочники для карточки товара: производитель, размер, форма и категория (линейка, например Delica
                11/0).
            </p>
            <Tabs defaultValue="MANUFACTURER">
                <TabsList className="flex h-auto flex-wrap gap-1">
                    {KINDS.map((kind) => (
                        <TabsTrigger key={kind} value={kind}>
                            {PRODUCT_ATTRIBUTE_KIND_LABELS[kind]}
                        </TabsTrigger>
                    ))}
                </TabsList>
                {KINDS.map((kind) => (
                    <TabsContent key={kind} value={kind}>
                        <AttributeKindPanel kind={kind} />
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
