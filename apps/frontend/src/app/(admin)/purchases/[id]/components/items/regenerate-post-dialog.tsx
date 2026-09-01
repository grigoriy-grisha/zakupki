'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/client/trpc';

import { useRegenerateItemDescription } from '../../hooks';
import { resolveDefaultTemplateId } from '../../lib/template-storage';

/**
 * Диалог перегенерации описания товара из шаблона поста.
 *
 * Сервер пересобирает DescriptionFields из актуальных данных товара и применяет
 * шаблон, после чего эмитит ITEM_CHANGED — worker обновит пост в канале.
 * Шаблон выбирается автоматически — как в форме редактирования товара
 * (последний выбор для этого товара → последний использованный → первый в списке).
 */
interface RegeneratePostDialogProps {
    purchaseId: number;
    purchaseItemId: number | null;
    productId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RegeneratePostDialog({
    purchaseId,
    purchaseItemId,
    productId,
    open,
    onOpenChange,
}: RegeneratePostDialogProps) {
    const { data: postTemplates } = trpc.postTemplates.list.useQuery(undefined, { enabled: open });
    const regenerate = useRegenerateItemDescription(purchaseId);

    const templates = postTemplates ?? [];
    const resolved = resolveDefaultTemplateId(productId, templates);
    const templateId = resolved === 'none' ? String(templates[0]?.id ?? '') : resolved;

    function handleRegenerate() {
        if (purchaseItemId == null || templateId === '') return;
        regenerate.mutate({ purchaseItemId, templateId: Number(templateId) });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Обновить пост в Telegram</DialogTitle>
                    <DialogDescription>
                        Описание будет перегенерировано с актуальными данными товара. Пост в канале обновится
                        автоматически.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button
                        disabled={regenerate.isPending || purchaseItemId == null || templateId === ''}
                        onClick={handleRegenerate}
                    >
                        {regenerate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Обновить пост в TG
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
