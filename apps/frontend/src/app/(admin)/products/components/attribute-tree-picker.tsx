'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
    findAttributeDisplayName,
    type AttributesTreeForType,
} from '@/app/(admin)/products/lib/product-form-utils';

type TypeRow = { id: number; name: string; parentId: number | null; position: number };

interface AttributeTreePickerProps {
    rootTypes: TypeRow[];
    childrenOfType: (parentId: number | null) => TypeRow[];
    attrsTreeByType: Record<number, AttributesTreeForType>;
    selectedAttrs: Record<number, number | null>;
    onSelect: (typeId: number, attributeId: number | null) => void;
}

function SelectableRow({
    active,
    label,
    nested = false,
    onClick,
}: {
    active: boolean;
    label: string;
    nested?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent',
                nested && 'ml-3',
                active && 'bg-accent font-medium',
            )}
        >
            <Check className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
            {label}
        </button>
    );
}

export function AttributeTreePicker({
    rootTypes,
    childrenOfType,
    attrsTreeByType,
    selectedAttrs,
    onSelect,
}: AttributeTreePickerProps) {
    const [open, setOpen] = useState(false);
    const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());
    const [expandedBrands, setExpandedBrands] = useState<Set<number>>(new Set());

    const allTypes: TypeRow[] = [];
    const walk = (ts: TypeRow[]) => ts.forEach((t) => { allTypes.push(t); walk(childrenOfType(t.id)); });
    walk(rootTypes);
    const byId = new Map(allTypes.map((t) => [t.id, t]));

    useEffect(() => {
        if (!open) return;
        const typeIds = new Set<number>();
        const brandIds = new Set<number>();

        for (const t of allTypes) {
            const selected = selectedAttrs[t.id];
            if (selected == null) continue;

            typeIds.add(t.id);
            let p = t.parentId;
            while (p != null) {
                typeIds.add(p);
                p = byId.get(p)?.parentId ?? null;
            }

            const tree = attrsTreeByType[t.id];
            if (!tree) continue;
            for (const brand of tree.brands) {
                if (brand.id === selected || brand.values.some((v) => v.id === selected)) {
                    brandIds.add(brand.id);
                }
            }
        }

        setExpandedTypes(typeIds);
        setExpandedBrands(brandIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    function toggleType(id: number) {
        setExpandedTypes((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleBrand(id: number) {
        setExpandedBrands((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function collectSummary(types: TypeRow[]): string[] {
        const out: string[] = [];
        for (const type of types) {
            const selected = selectedAttrs[type.id] ?? null;
            if (selected != null) {
                const name = findAttributeDisplayName(attrsTreeByType, type.id, selected);
                if (name) out.push(name);
            }
            out.push(...collectSummary(childrenOfType(type.id)));
        }
        return out;
    }

    const summary = collectSummary(rootTypes);

    function renderTypeAttributes(typeId: number, selected: number | null) {
        const tree = attrsTreeByType[typeId] ?? { topValues: [], brands: [] };
        const hasContent = tree.topValues.length > 0 || tree.brands.length > 0;

        if (!hasContent) {
            return <p className="px-2 py-1 text-xs italic text-muted-foreground/70">нет значений</p>;
        }

        return (
            <>
                {tree.topValues.map((v) => (
                    <SelectableRow
                        key={v.id}
                        active={selected === v.id}
                        label={v.name}
                        onClick={() => onSelect(typeId, selected === v.id ? null : v.id)}
                    />
                ))}

                {tree.brands.map((brand) => {
                    const brandOpen = expandedBrands.has(brand.id);
                    const brandSelected = selected === brand.id;
                    const childSelected = brand.values.some((v) => v.id === selected);

                    return (
                        <div key={brand.id}>
                            <div className="flex items-center gap-0.5 rounded-md hover:bg-accent/50">
                                <button
                                    type="button"
                                    onClick={() => toggleBrand(brand.id)}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center"
                                >
                                    <ChevronRight
                                        className={cn(
                                            'h-4 w-4 text-muted-foreground transition-transform',
                                            brandOpen && 'rotate-90',
                                        )}
                                    />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onSelect(typeId, brandSelected ? null : brand.id)}
                                    className={cn(
                                        'flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left text-sm',
                                        brandSelected && 'bg-accent font-medium',
                                    )}
                                >
                                    <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{brand.name}</span>
                                    {brandSelected && !childSelected && (
                                        <Check className="ml-auto h-4 w-4 shrink-0" />
                                    )}
                                </button>
                            </div>

                            {brandOpen && brand.values.length > 0 && (
                                <div className="ml-3 border-l-2 border-muted pl-2">
                                    {brand.values.map((v) => (
                                        <SelectableRow
                                            key={v.id}
                                            active={selected === v.id}
                                            label={v.name}
                                            nested
                                            onClick={() => onSelect(typeId, selected === v.id ? null : v.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        );
    }

    function renderNodes(types: TypeRow[]): React.ReactNode {
        return types.map((type) => {
            const selected = selectedAttrs[type.id] ?? null;
            const children = childrenOfType(type.id);
            const isOpen = expandedTypes.has(type.id);
            const selectedName =
                selected != null ? findAttributeDisplayName(attrsTreeByType, type.id, selected) : undefined;
            const tree = attrsTreeByType[type.id];
            const hasValues =
                (tree?.topValues.length ?? 0) > 0 || (tree?.brands.length ?? 0) > 0 || children.length > 0;

            return (
                <div key={type.id}>
                    <button
                        type="button"
                        onClick={() => toggleType(type.id)}
                        className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-accent/50"
                    >
                        <ChevronRight
                            className={cn(
                                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                isOpen && 'rotate-90',
                            )}
                        />
                        <span className="text-sm font-medium">{type.name}</span>
                        {selectedName && (
                            <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{selectedName}</span>
                        )}
                    </button>

                    {isOpen && (
                        <div className="ml-3 space-y-0.5 border-l-2 border-muted pl-2">
                            {hasValues ? renderTypeAttributes(type.id, selected) : null}
                            {children.length > 0 && renderNodes(children)}
                        </div>
                    )}
                </div>
            );
        });
    }

    return (
        <div className="space-y-2">
            <Label>Атрибуты</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-9 w-full justify-between whitespace-normal text-left font-normal"
                    >
                        <span className={cn(summary.length === 0 && 'text-muted-foreground')}>
                            {summary.length > 0 ? summary.join(' / ') : 'Выберите из дерева'}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="max-h-80 w-(--radix-popover-trigger-width) overflow-y-auto p-2">
                    <div className="space-y-0.5">{renderNodes(rootTypes)}</div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
