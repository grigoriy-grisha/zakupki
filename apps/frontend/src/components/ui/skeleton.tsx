import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                'relative overflow-hidden rounded-md bg-skeleton',
                'after:absolute after:inset-0 after:animate-shimmer after:bg-[linear-gradient(90deg,transparent_0%,var(--border-low)_50%,transparent_100%)] after:bg-[length:200%_100%]',
                className,
            )}
            {...props}
        />
    );
}

export { Skeleton };
