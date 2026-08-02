import * as React from 'react';

import { cn } from '@/lib/utils';

interface FormFooterProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Sticky footer для форм. Использует отрицательные margin,
 * чтобы «прилипать» к низу scrollable-контейнера (Sheet/Dialog) или страницы.
 *
 * Использование:
 * ```tsx
 * <div className="flex flex-col gap-4 px-4">
 *   ...поля формы...
 *   <FormFooter>
 *     <Button variant="outline">Отмена</Button>
 *     <Button>Сохранить</Button>
 *   </FormFooter>
 * </div>
 * ```
 */
function FormFooter({ children, className }: FormFooterProps) {
    return (
        <div
            className={cn(
                'sticky bottom-0 -mx-4 mt-2 flex flex-col-reverse items-stretch gap-2 border-t border-border bg-bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-end',
                className,
            )}
        >
            {children}
        </div>
    );
}

export { FormFooter };
export type { FormFooterProps };
