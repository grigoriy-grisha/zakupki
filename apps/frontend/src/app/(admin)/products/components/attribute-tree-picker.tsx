'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type TypeRow = { id: number; name: string; parentId: number | null; position: number };

interface AttributeTreePickerProps {
    rootTypes: TypeRow[];
    childrenOfType: (parentId: number | null) => TypeRow[];
    attrsByType: Record<number, { id: number; name: string }[]>;
    selectedAttrs: Record<number, number | null>;
    onSelect: (typeId: number, attributeId: number | null) => void;
}

export function AttributeTreePicker({
    rootTypes,
    childrenOfType,
    attrsByType,
    selectedAttrs,
    onSelect,
}: AttributeTreePickerProps) {
    const [open, setOpen] = useState(false);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    // Плоский список всех типов + быстрый доступ по id (для авто-раскрытия предков).
    const allTypes: TypeRow[] = [];
    const walk = (ts: TypeRow[]) => ts.forEach((t) => { allTypes.push(t); walk(childrenOfType(t.id)); });
    walk(rootTypes);
    const byId = new Map(allTypes.map((t) => [t.id, t]));

    // При открытии раскрываем ветки, где уже есть выбор.
    useEffect(() => {
        if (!open) return;
        const ids = new Set<number>();
        for (const t of allTypes) {
            if (selectedAttrs[t.id] != null) {
                ids.add(t.id);
                let p = t.parentId;
                while (p != null) {
                    ids.add(p);
                    p = byId.get(p)?.parentId ?? null;
                }
            }
        }
        setExpanded(ids);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    function toggle(id: number) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    // Сводка выбранных значений в порядке дерева (для надписи на кнопке).
    function collectSummary(types: TypeRow[]): string[] {
        const out: string[] = [];
        for (const type of types) {
            const selected = selectedAttrs[type.id] ?? null;
            if (selected != null) {
                const name = (attrsByType[type.id] ?? []).find((v) => v.id === selected)?.name;
                if (name) out.push(name);
            }
            out.push(...collectSummary(childrenOfType(type.id)));
        }
        return out;
    }

    const summary = collectSummary(rootTypes);

    function renderNodes(types: TypeRow[]): React.ReactNode {
        return types.map((type) => {
            const values = attrsByType[type.id] ?? [];
            const selected = selectedAttrs[type.id] ?? null;
            const children = childrenOfType(type.id);
            const isOpen = expanded.has(type.id);
            const selectedName = selected != null ? values.find((v) => v.id === selected)?.name : undefined;

            return (
                <div key={type.id}>
                    <button
                        type="button"
                        onClick={() => toggle(type.id)}
                        className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-accent/50"
                    >
                        <ChevronRight
                            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-90')}
                        />
                        <span className="text-sm font-medium">{type.name}</span>
                        {selectedName && (
                            <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{selectedName}</span>
                        )}
                    </button>

                    {isOpen && (
                        <div className="ml-3 space-y-1 border-l-2 border-muted pl-2">
                            {values.length > 0 ? (
                                values.map((v) => {
                                    const active = selected === v.id;
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => onSelect(type.id, active ? null : v.id)}
                                            className={cn(
                                                'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent',
                                                active && 'bg-accent font-medium',
                                            )}
                                        >
                                            <Check
                                                className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')}
                                            />
                                            {v.name}
                                        </button>
                                    );
                                })
                            ) : children.length === 0 ? (
                                <p className="px-2 py-1 text-xs italic text-muted-foreground/70">нет значений</p>
                            ) : null}
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
