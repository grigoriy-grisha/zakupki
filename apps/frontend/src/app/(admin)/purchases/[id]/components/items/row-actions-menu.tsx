'use client';

import { EyeOff, MoreHorizontal, Pencil, RefreshCw, Send, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell } from '@/components/ui/table';
import type { ProductLabelSource } from '@/lib/product-label';

export function RowActionsCell({
    itemId,
    product,
    hidden,
    published,
    isActive,
    orderCount,
    onEdit,
    onPublish,
    onDelete,
    onCommitHidden,
    onDeletePost,
    onRegenerate,
}: {
    itemId: number;
    product: ProductLabelSource;
    hidden?: boolean;
    published: boolean;
    isActive: boolean;
    orderCount: number;
    onEdit: (id: number) => void;
    onPublish: (id: number) => void;
    onDelete: (target: { id: number; product: ProductLabelSource; orderCount: number; published: boolean }) => void;
    onCommitHidden: (hidden: boolean) => void;
    onDeletePost?: (itemId: number) => void;
    onRegenerate?: (target: { itemId: number }) => void;
}) {
    return (
        <TableCell className="sticky right-0 z-10 bg-bg-soft group-hover:bg-bg-card">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Действия"
                        className="size-8 rounded-full text-fg-secondary opacity-60 group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuItem onClick={() => onEdit(itemId)}>
                        <Pencil className="size-3.5" /> Редактировать
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCommitHidden(!hidden)}>
                        <EyeOff className="size-3.5" />
                        {hidden ? 'Показать' : 'Скрыть'}
                    </DropdownMenuItem>
                    {!published && isActive && !hidden && (
                        <DropdownMenuItem onClick={() => onPublish(itemId)}>
                            <Send className="size-3.5" /> Опубликовать в TG
                        </DropdownMenuItem>
                    )}
                    {published && onDeletePost && (
                        <DropdownMenuItem onClick={() => onDeletePost(itemId)}>
                            <Trash2 className="size-3.5" /> Удалить пост в TG
                        </DropdownMenuItem>
                    )}
                    {published && onRegenerate && (
                        <DropdownMenuItem onClick={() => onRegenerate({ itemId })}>
                            <RefreshCw className="size-3.5" /> Обновить пост в TG
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => onDelete({ id: itemId, product, orderCount, published })}
                        className="text-error focus:text-error"
                    >
                        <Trash2 className="size-3.5" /> Удалить
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </TableCell>
    );
}
