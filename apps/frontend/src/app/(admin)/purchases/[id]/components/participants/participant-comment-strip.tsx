'use client';

import { Loader2, MessageSquare, Pencil, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { formatCommentAt } from '../../lib/format-comment-at';

const MAX_LENGTH = 2000;
// Эвристика: показывать toggle «Ещё/Свернуть», только если комментарий
// длиннее этого порога. line-clamp-2 ≈ 2 строки × 70 символов.
const TRUNCATE_THRESHOLD = 140;

interface ParticipantCommentStripProps {
    /** ID PurchaseOrder (один на пару user+purchase) — для мутации. */
    purchaseOrderId: number;
    /** Имя участника — для screen-reader'ов и tooltip'ов. */
    participantName: string;
    initialComment: string | null;
    initialCommentAt: string | null; // ISO
    initialCommentAuthor: number | null;
    isPending: boolean;
    /** Сохранение: пустая строка → удаление комментария на бэке. */
    onSave: (comment: string) => void;
}

/**
 * Полоса комментария к участнику закупки. Рендерится в раскрытом теле
 * карточки участника (между header и grid «Заказ/Оплаты»). Поддерживает
 * три режима: read с комментарием, read без (empty state) и edit.
 */
export function ParticipantCommentStrip({
    participantName,
    initialComment,
    initialCommentAt,
    initialCommentAuthor,
    isPending,
    onSave,
}: ParticipantCommentStripProps) {
    const [mode, setMode] = useState<'read' | 'edit'>('read');
    const [value, setValue] = useState(initialComment ?? '');
    const [expanded, setExpanded] = useState(false);

    // Синхронизируем локальный draft с актуальным значением с сервера,
    // но не трогаем textarea, пока админ печатает.
    useEffect(() => {
        if (mode === 'read') {
            setValue(initialComment ?? '');
        }
    }, [initialComment, mode]);

    const trimmedLength = value.trim().length;
    const isEmpty = trimmedLength === 0;
    const isDirty = value.trim() !== (initialComment ?? '').trim();
    const hasComment = !isEmpty;
    const formattedAt = formatCommentAt(initialCommentAt);

    const enterEdit = () => {
        setValue(initialComment ?? '');
        setMode('edit');
    };
    const cancelEdit = () => {
        setValue(initialComment ?? '');
        setMode('read');
    };
    const handleSave = () => {
        onSave(value);
    };

    return (
        <div
            className="rounded-2xl bg-bg-soft p-3"
            aria-label={`Комментарий к участнику ${participantName}`}
        >
            {mode === 'read' ? (
                <div className="flex items-start gap-3">
                    <span
                        className={cn(
                            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                            hasComment
                                ? 'bg-secondary/10 text-secondary'
                                : 'bg-bg-soft text-fg-tertiary',
                        )}
                        aria-hidden
                    >
                        <MessageSquare className="size-3.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                        {hasComment ? (
                            <>
                                <p
                                    className={cn(
                                        'whitespace-pre-wrap text-13-regular text-fg-primary',
                                        !expanded && 'line-clamp-2',
                                    )}
                                >
                                    {initialComment}
                                </p>
                                {(initialComment?.length ?? 0) > TRUNCATE_THRESHOLD && (
                                    <button
                                        type="button"
                                        onClick={() => setExpanded((p) => !p)}
                                        className="mt-1 text-12-medium text-primary hover:underline"
                                    >
                                        {expanded ? 'Свернуть' : 'Ещё'}
                                    </button>
                                )}
                            </>
                        ) : (
                            <p className="text-13-regular text-fg-tertiary">Комментария нет</p>
                        )}

                        <p className="mt-1 text-12-regular text-fg-tertiary">
                            {hasComment && formattedAt ? (
                                <>
                                    Обновлён {formattedAt}
                                    {initialCommentAuthor != null
                                        ? ` · админ #${initialCommentAuthor}`
                                        : ''}
                                </>
                            ) : (
                                <>Добавьте заметку об участнике</>
                            )}
                        </p>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={enterEdit}
                        aria-label={
                            hasComment
                                ? 'Редактировать комментарий'
                                : 'Добавить комментарий к участнику'
                        }
                        className="size-7 shrink-0 text-fg-tertiary hover:text-fg-primary"
                    >
                        <Pencil className="size-4" />
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary"
                            aria-hidden
                        >
                            <MessageSquare className="size-3.5" />
                        </span>
                        <span className="text-12-medium uppercase tracking-wide text-fg-tertiary">
                            {hasComment ? 'Редактирование комментария' : 'Новый комментарий'}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={cancelEdit}
                            disabled={isPending}
                            aria-label="Отмена"
                            className="ml-auto size-7 text-fg-tertiary hover:text-fg-primary"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>

                    <Textarea
                        autoFocus
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        maxLength={MAX_LENGTH}
                        placeholder="Например: «замена — обсудили в чате»"
                        rows={4}
                        disabled={isPending}
                    />
                    <div className="flex items-center justify-between text-12-regular text-fg-tertiary">
                        <span>
                            {trimmedLength} / {MAX_LENGTH}
                        </span>
                        {isEmpty && (initialComment ?? '') !== '' && (
                            <span className="text-warning">Сохранение удалит комментарий</span>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={isPending}
                        >
                            Отмена
                        </Button>
                        <Button
                            variant="brand"
                            size="sm"
                            onClick={handleSave}
                            disabled={isPending || !isDirty}
                        >
                            {isPending && <Loader2 className="size-4 animate-spin" />}
                            {isEmpty && (initialComment ?? '') !== '' ? 'Удалить' : 'Сохранить'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
