import * as React from 'react';

import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                'field-sizing-content min-h-16 w-full rounded-md border border-border bg-bg-card px-3 py-2 text-16-regular text-fg-primary shadow-xs transition-[color,box-shadow] outline-none',
                'placeholder:text-fg-tertiary',
                'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
                'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
                'md:text-14-regular',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        />
    );
}

export { Textarea };
