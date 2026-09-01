'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Tabs({ className, orientation = 'horizontal', ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return (
        <TabsPrimitive.Root
            data-slot="tabs"
            data-orientation={orientation}
            orientation={orientation}
            className={cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col', className)}
            {...props}
        />
    );
}

const tabsListVariants = cva(
    'group/tabs-list inline-flex w-fit items-center text-fg-secondary group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col',
    {
        variants: {
            variant: {
                // Pill-вариант (Figma DS): активный — синяя заливка, неактивные — синий текст.
                default: 'gap-2 rounded-full bg-transparent p-1',
                // Line-вариант: классический underline-индикатор.
                line: 'gap-0 bg-transparent border-b border-border',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

function TabsList({
    className,
    variant = 'default',
    ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            data-variant={variant}
            className={cn(tabsListVariants({ variant }), className)}
            {...props}
        />
    );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                // Базовый стиль
                "relative inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-13-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-3.5",
                // Pill-вариант (Figma DS): неактивный — синий текст, активный — синяя заливка
                "text-secondary hover:text-secondary/80",
                "data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground",
                // Line-вариант: без pill-фона, underline снизу
                "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:bg-transparent",
                "group-data-[variant=line]/tabs-list:px-4 group-data-[variant=line]/tabs-list:py-2 group-data-[variant=line]/tabs-list:h-10",
                "group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=active]/tabs-list:data-[state=active]:shadow-none",
                "group-data-[variant=line]/tabs-list:data-[state=active]:text-fg-primary",
                // Line: underline через ::after
                "after:absolute after:left-3 after:right-3 after:bottom-[-1px] after:h-0.5 after:rounded-full after:bg-primary after:opacity-0 after:transition-opacity",
                "group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
                className,
            )}
            {...props}
        />
    );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return <TabsPrimitive.Content data-slot="tabs-content" className={cn('flex-1 outline-none', className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, tabsListVariants,TabsTrigger };
