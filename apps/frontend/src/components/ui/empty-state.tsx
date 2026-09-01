import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function EmptyState({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    className,
    iconClassName,
    variant = 'tile',
}: {
    icon?: React.ComponentType<{ className?: string; size?: number | string }>;
    title: React.ReactNode;
    description?: React.ReactNode;
    actionLabel?: React.ReactNode;
    onAction?: () => void;
    className?: string;
    iconClassName?: string;
    variant?: 'tile' | 'plain';
}) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', className)}>
            {Icon &&
                (variant === 'plain' ? (
                    <Icon className={cn('mb-2 size-14 text-secondary', iconClassName)} />
                ) : (
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-soft text-fg-secondary">
                        <Icon className="size-5" />
                    </div>
                ))}
            <p className="text-18-semibold text-fg-primary">{title}</p>
            {description && <p className="max-w-[360px] text-14-regular text-fg-secondary">{description}</p>}
            {actionLabel && onAction && (
                <Button variant="brand" onClick={onAction} className="mt-3 rounded-full">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

export { EmptyState };
