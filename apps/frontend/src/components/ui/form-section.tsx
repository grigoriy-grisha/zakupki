import * as React from 'react';

import { cn } from '@/lib/utils';

interface FormSectionProps {
    /** Заголовок секции (например, «Цена»). */
    title?: React.ReactNode;
    /** Краткое пояснение под заголовком. */
    description?: React.ReactNode;
    /** Контент секции. */
    children: React.ReactNode;
    /** Действие справа (например, кнопка «Добавить тир»). */
    action?: React.ReactNode;
    /** Визуально выделить секцию карточкой (`rounded-2xl border bg-bg-card p-4`). */
    card?: boolean;
    className?: string;
}

/**
 * Секция формы с заголовком/подсказкой/действием.
 * Если `card` — оборачивается в `rounded-2xl border border-border bg-bg-card p-4` (визуально выделенная группа).
 */
function FormSection({ title, description, children, action, card = false, className }: FormSectionProps) {
    const content = (
        <>
            {(title || action) && (
                <div className="flex items-center justify-between gap-2">
                    {(title || description) && (
                        <div className="min-w-0">
                            {title && (
                                <h3 className="text-13-medium uppercase tracking-wide text-fg-secondary">
                                    {title}
                                </h3>
                            )}
                            {description && (
                                <p className="mt-0.5 text-12-regular text-fg-tertiary">{description}</p>
                            )}
                        </div>
                    )}
                    {action}
                </div>
            )}
            {children}
        </>
    );
    if (card) {
        return (
            <div className={cn('space-y-3 rounded-2xl border border-border bg-bg-card p-4', className)}>
                {content}
            </div>
        );
    }
    return <div className={cn('space-y-2', className)}>{content}</div>;
}

export { FormSection };
export type { FormSectionProps };
