import * as React from 'react';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'critical';
export type BadgeType = 'subtle' | 'inline' | 'accent' | 'glass';
/** Старые shadcn-варианты (для обратной совместимости с уже написанным кодом). */
export type LegacyBadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary' | BadgeVariant;

const glassNeutral = 'border-white/40 bg-bg-card/70 text-fg-primary shadow-sm backdrop-blur-md';

const colorMap: Record<BadgeVariant, Record<BadgeType, string>> = {
    neutral: {
        subtle: 'bg-bg-soft text-fg-secondary',
        inline: 'text-fg-secondary',
        accent: 'bg-fg-primary text-bg-card',
        glass: glassNeutral,
    },
    accent: {
        subtle: 'bg-primary/10 text-primary',
        inline: 'text-primary',
        accent: 'bg-primary text-primary-foreground',
        glass: 'border-white/40 bg-primary/70 text-primary-foreground shadow-sm backdrop-blur-md',
    },
    success: {
        subtle: 'bg-success-50 text-success',
        inline: 'text-success',
        accent: 'bg-success text-success-foreground',
        glass: 'border-white/40 bg-success/70 text-success-foreground shadow-sm backdrop-blur-md',
    },
    warning: {
        subtle: 'bg-warning-50 text-warning',
        inline: 'text-warning',
        accent: 'bg-warning text-warning-foreground',
        glass: 'border-white/40 bg-warning/70 text-warning-foreground shadow-sm backdrop-blur-md',
    },
    critical: {
        subtle: 'bg-error-50 text-error',
        inline: 'text-error',
        accent: 'bg-error text-error-foreground',
        glass: 'border-white/40 bg-error/70 text-error-foreground shadow-sm backdrop-blur-md',
    },
};

/** Маппинг старых вариантов на новые. */
const legacyVariantMap: Record<string, BadgeVariant> = {
    default: 'accent',
    secondary: 'neutral',
    destructive: 'critical',
    outline: 'neutral',
};
const legacyTypeMap: Record<string, BadgeType> = {
    default: 'subtle',
    secondary: 'subtle',
    destructive: 'accent',
    outline: 'inline',
};

const sizeMap = {
    sm: 'text-12-medium px-2 py-0.5',
    default: 'text-12-medium px-2.5 py-0.5',
    lg: 'text-14-medium px-3 py-1',
};

type BadgeProps = React.ComponentProps<'span'> & {
    variant?: LegacyBadgeVariant;
    type?: BadgeType;
    size?: keyof typeof sizeMap;
    asChild?: boolean;
};

function Badge({
    className,
    variant = 'neutral',
    type,
    size = 'default',
    asChild = false,
    ...props
}: BadgeProps) {
    const Comp = asChild ? Slot.Root : 'span';
    const resolvedVariant: BadgeVariant = legacyVariantMap[variant] ?? (variant as BadgeVariant);
    const resolvedType: BadgeType = type ?? legacyTypeMap[variant as string] ?? 'subtle';
    const isPill = resolvedType !== 'inline';
    return (
        <Comp
            data-slot="badge"
            data-variant={resolvedVariant}
            data-type={resolvedType}
            className={cn(
                'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap',
                isPill ? 'rounded-full border border-transparent' : 'rounded-md border-transparent',
                colorMap[resolvedVariant][resolvedType],
                sizeMap[size],
                '[&>svg]:pointer-events-none [&>svg]:size-3',
                className,
            )}
            {...props}
        />
    );
}

export { Badge };
