'use client';

import { useEffect, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/client/trpc';

import { useRegenerateItemDescription } from '../../hooks';

/**
 * Диалог перегенерации описания товара из шаблона поста.
 *
 * Сервер пересобирает DescriptionFields из актуальных данных товара и применяет
 * выбранный шаблон, после чего эмитит ITEM_CHANGED — worker обновит пост в канале.
 * Применяется к уже опубликованным товарам, когда тело шаблона изменилось
 * в Settings или когда хочется актуализировать пост без открытия формы.
 *
 * «Без шаблона» (templateId = null) очищает описание.
 */
interface RegeneratePostDialogProps {
    purchaseId: number;
    purchaseItemId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RegeneratePostDialog({
    purchaseId,
    purchaseItemId,
    open,
    onOpenChange,
}: RegeneratePostDialogProps) {
    const { data: postTemplates } = trpc.postTemplates.list.useQuery(undefined, { enabled: open });
    const [templateId, setTemplateId] = useState<string>('none');
    const regenerate = useRegenerateItemDescription(purchaseId);

    // По умолчанию выбираем первый шаблон (если есть), иначе «Без шаблона».
    useEffect(() => {
        if (!open) return;
        setTemplateId(postTemplates?.length ? String(postTemplates[0].id) : 'none');
    }, [open, postTemplates]);

    function handleRegenerate() {
        if (purchaseItemId == null) return;
        regenerate.mutate({
            purchaseItemId,
            templateId: templateId === 'none' ? null : Number(templateId),
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Обновить пост в Telegram</DialogTitle>
                    <DialogDescription>
                        Описание будет перегенерировано из выбранного шаблона с актуальными данными
                        товара. Пост в канале обновится автоматически.
                    </DialogDescription>
                </DialogHeader>
                <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Без шаблона" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Без шаблона (очистить)</SelectItem>
                        {(postTemplates ?? []).map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                                {t.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button
                        disabled={regenerate.isPending || purchaseItemId == null}
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
