import * as React from 'react';

import { cn } from '@/lib/utils';

function SectionHeader({
    title,
    description,
    actions,
    className,
}: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
            <div className="min-w-0">
                <h2 className="text-18-semibold text-fg-primary tracking-tight">{title}</h2>
                {description && <p className="mt-0.5 text-14-regular text-fg-secondary">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
    );
}

export { SectionHeader };
