import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-14-bold transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                // Основная (Figma DS): красная пилюля, hover — темнее + тень.
                default: 'bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-cta',
                // Алиас основной (совместимость), раньше отличался тенью.
                brand: 'bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-cta',
                destructive:
                    'bg-destructive text-destructive-foreground hover:bg-primary-hover hover:shadow-cta focus-visible:ring-destructive/20',
                // Нейтральная контурная — для плотных интерфейсов (админка).
                outline:
                    'border border-border bg-transparent text-fg-primary hover:border-border-strong hover:bg-bg-soft',
                // Контурная красная (Figma DS «Войти через Telegram»).
                'outline-primary':
                    'border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-cta-soft',
                // Контурная синяя (Figma DS «Продолжить как …»).
                secondary:
                    'border-2 border-secondary bg-transparent text-secondary hover:bg-secondary hover:text-secondary-foreground hover:shadow-cta-soft',
                ghost: 'text-fg-primary hover:bg-bg-soft',
                link: 'text-primary underline-offset-4 hover:underline',
            },
            size: {
                // CTA-высота по DS — 48px на обеих платформах.
                default: 'h-12 px-6 text-14-bold has-[>svg]:px-5 md:text-16-bold',
                xs: 'h-6 gap-1 px-2.5 text-12-bold has-[>svg]:px-1.5',
                sm: 'h-9 gap-1.5 px-4 text-14-bold has-[>svg]:px-3',
                lg: 'h-12 px-8 text-14-bold has-[>svg]:px-6 md:text-16-bold',
                // Компактная мобильная пилюля 20px (Figma DS «Добавить»).
                pill: 'h-5 gap-1 px-3 text-10-bold has-[>svg]:px-2 [&_svg:not([class*="size-"])]:size-3',
                icon: 'size-12',
                'icon-xs': 'size-6 [&_svg:not([class*="size-"])]:size-3',
                'icon-sm': 'size-9',
                'icon-lg': 'size-12',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

function Button({
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : 'button';

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
