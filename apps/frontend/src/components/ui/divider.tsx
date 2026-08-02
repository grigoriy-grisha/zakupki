import * as React from 'react';

import { cn } from '@/lib/utils';

function Divider({ className, ...props }: React.ComponentProps<'hr'>) {
    return <hr className={cn('border-0 border-t border-border-low my-6 md:my-8', className)} {...props} />;
}

export { Divider };
