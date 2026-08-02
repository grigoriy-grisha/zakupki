import * as React from 'react';

import { cn } from '@/lib/utils';

type PageHeaderVariant = 'default' | 'with-icon';

type PageHeaderProps = {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    badge?: React.ReactNode;
    className?: string;
    /** Layout variant. 'default' — стандартный шапочный вариант; 'with-icon' — с иконкой слева. */
    variant?: PageHeaderVariant;
    /** Иконка слева (только для variant='with-icon'). */
    icon?: React.ReactNode;
    /** Альтернативный description для мобильных (только для variant='with-icon'). */
    descriptionMobile?: React.ReactNode;
};

function PageHeader({
    title,
    description,
    actions,
    badge,
    className,
    variant = 'default',
    icon,
    descriptionMobile,
}: PageHeaderProps) {
    if (variant === 'with-icon') {
        return (
            <div className={cn('mb-6 flex items-start justify-between gap-4 sm:mb-8', className)}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    {icon && (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        {badge && <div className="mb-2">{badge}</div>}
                        <h1 className="text-24-semibold text-fg-primary sm:text-30-semibold">{title}</h1>
                        {descriptionMobile ? (
                            <>
                                <p className="mt-1 hidden text-14-regular text-fg-secondary sm:block">
                                    {description}
                                </p>
                                <p className="mt-1 text-14-regular text-fg-secondary sm:hidden">
                                    {descriptionMobile}
                                </p>
                            </>
                        ) : (
                            description && (
                                <p className="mt-1 text-14-regular text-fg-secondary">{description}</p>
                            )
                        )}
                    </div>
                </div>
                {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
        );
    }

    return (
        <div className={cn('mb-6 flex items-start justify-between gap-4 sm:mb-8', className)}>
            <div className="min-w-0 flex-1">
                {badge && <div className="mb-2">{badge}</div>}
                <h1 className="text-24-semibold text-fg-primary sm:text-30-semibold">{title}</h1>
                {description && <p className="mt-1 text-14-regular text-fg-secondary">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
    );
}

export { PageHeader };
export type { PageHeaderProps, PageHeaderVariant };
