import * as React from 'react';

import { cn } from '@/lib/utils';

function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'flex flex-1 flex-col bg-bg-base',
                'px-4 py-6 md:rounded-4xl md:border md:border-border md:bg-bg-card md:px-14 md:py-10',
                'min-h-0 overflow-y-auto',
            )}
        >
            <div className={cn('mx-auto flex w-full max-w-6xl flex-1 flex-col', className)}>{children}</div>
        </div>
    );
}

export { PageContent };
