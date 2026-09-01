import * as React from 'react';

import { cn } from '@/lib/utils';

function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 md:px-10 md:py-8')}>
            <div className={cn('mx-auto flex w-full max-w-[1362px] flex-1 flex-col', className)}>{children}</div>
        </div>
    );
}

export { PageContent };
