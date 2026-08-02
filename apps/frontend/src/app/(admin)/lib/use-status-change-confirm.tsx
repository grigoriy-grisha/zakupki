'use client';

import { useCallback, useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';

export interface StatusChangeRequest<TStatus extends string> {
    /** Целевой статус, на который хотим переключиться. */
    target: TStatus;
    /** Текст кнопки подтверждения (например, «Завершить закупку»). */
    confirmLabel?: string;
    /** Кастомный заголовок диалога (опц.). */
    title?: string;
    /** Кастомное описание (опц., может быть JSX). */
    description?: React.ReactNode;
    /** Доп. контекст для отображения (например, тег закупки). */
    context?: string;
}

export interface UseStatusChangeConfirmOptions<TStatus extends string> {
    /** Функция, которая строит title/description по target. */
    buildMessage?: (req: StatusChangeRequest<TStatus>) => {
        title: string;
        description: React.ReactNode;
        confirmLabel: string;
        variant?: 'default' | 'destructive';
    };
    /** Колбэк, вызываемый только при подтверждении пользователем. */
    onConfirm: (req: StatusChangeRequest<TStatus>) => void | Promise<void>;
}

interface PendingRequest<TStatus extends string> {
    req: StatusChangeRequest<TStatus>;
    meta: { title: string; description: React.ReactNode; confirmLabel: string; variant: 'default' | 'destructive' };
}

/**
 * Хук для безопасной смены статуса. Перед вызовом колбэка всегда открывает
 * ConfirmDialog — пользователь должен явно подтвердить действие. Защищает от
 * случайной смены статуса (особенно деструктивных переходов: завершить / удалить).
 *
 * Использование:
 * ```tsx
 * const { dialog: statusDialog, requestStatusChange } = useStatusChangeConfirm({
 *   onConfirm: (req) => actions.complete.mutate({ id: req.target }),
 *   buildMessage: (req) => ({
 *     title: 'Завершить закупку?',
 *     description: 'Дальше изменить будет нельзя.',
 *     confirmLabel: 'Завершить',
 *     variant: 'destructive',
 *   }),
 * });
 * return (<>{statusDialog}<Button onClick={() => requestStatusChange({ target: 'DONE' })}>Завершить</Button></>);
 * ```
 */
export function useStatusChangeConfirm<TStatus extends string>({
    onConfirm,
    buildMessage,
}: UseStatusChangeConfirmOptions<TStatus>) {
    const [pending, setPending] = useState<PendingRequest<TStatus> | null>(null);

    const requestStatusChange = useCallback(
        (req: StatusChangeRequest<TStatus>) => {
            const defaultMeta = {
                title: req.title ?? `Сменить статус на «${req.target}»?`,
                description:
                    req.description ??
                    (req.context ? `Объект: ${req.context}.` : 'Вы уверены, что хотите изменить статус?'),
                confirmLabel: req.confirmLabel ?? 'Подтвердить',
                variant: 'default' as const,
            };
            const meta = buildMessage ? { ...defaultMeta, ...buildMessage(req) } : defaultMeta;
            setPending({ req, meta });
        },
        [buildMessage],
    );

    function handleConfirm() {
        if (!pending) return;
        Promise.resolve(onConfirm(pending.req)).finally(() => setPending(null));
    }

    const dialog = pending ? (
        <ConfirmDialog
            open
            onOpenChange={(open) => {
                if (!open) setPending(null);
            }}
            title={pending.meta.title}
            description={pending.meta.description}
            confirmLabel={pending.meta.confirmLabel}
            variant={pending.meta.variant ?? 'default'}
            onConfirm={handleConfirm}
        />
    ) : null;

    return { requestStatusChange, dialog, isOpen: pending != null };
}
