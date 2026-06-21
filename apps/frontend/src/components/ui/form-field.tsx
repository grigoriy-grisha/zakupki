import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps {
    /** Подпись поля. */
    label?: React.ReactNode;
    /** Подсказка под полем (если нет ошибки). */
    hint?: React.ReactNode;
    /** Текст ошибки (показывается вместо hint). */
    error?: React.ReactNode;
    /** Пометить поле как обязательное (`*` после label). */
    required?: boolean;
    /** id инпута (для `<Label htmlFor>`). */
    htmlFor?: string;
    /** Контент поля (input/select/etc). */
    children: React.ReactNode;
    /** Класс для обёртки. */
    className?: string;
}

/**
 * Обёртка поля формы: label сверху, инпут/select, hint или error снизу.
 */
function FormField({ label, hint, error, required, htmlFor, children, className }: FormFieldProps) {
    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <Label
                    htmlFor={htmlFor}
                    className="text-13-medium text-fg-primary"
                >
                    {label}
                    {required && <span className="ml-0.5 text-error">*</span>}
                </Label>
            )}
            {children}
            {error ? (
                <p className="text-12-regular text-error">{error}</p>
            ) : hint ? (
                <p className="text-12-regular text-fg-tertiary">{hint}</p>
            ) : null}
        </div>
    );
}

export { FormField };
export type { FormFieldProps };
