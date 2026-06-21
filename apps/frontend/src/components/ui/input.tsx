import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                'h-9 w-full min-w-0 rounded-md border border-border bg-bg-card px-3 py-1 text-16-regular text-fg-primary shadow-xs transition-[color,box-shadow] outline-none',
                'placeholder:text-fg-tertiary',
                'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
                'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
                'md:text-14-regular',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-14-medium file:text-fg-primary',
                className,
            )}
            {...props}
        />
    );
}

export { Input };
