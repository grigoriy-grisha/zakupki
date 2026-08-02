'use client';

import * as React from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';

function TooltipProvider({ delayDuration = 0, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
    return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />;
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
    return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
    return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

const ARROW_SVG =
    'M0,0 L8,0 A4,4 0 0 1 0,8 Z'; // плавный угол, никаких прозрачных стыков

function TooltipArrow({ className, ...props }: React.ComponentProps<typeof TooltipPrimitive.Arrow>) {
    return (
        <TooltipPrimitive.Arrow
            data-slot="tooltip-arrow"
            width={10}
            height={5}
            className={cn('fill-fg-primary', className)}
            {...props}
        />
    );
}

function TooltipContent({
    className,
    sideOffset = 6,
    children,
    style,
    ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
                data-slot="tooltip-content"
                sideOffset={sideOffset}
                style={{
                    // Гарантируем непрозрачный фон через fallback literal-color.
                    backgroundColor: 'var(--fg-primary, #09090b)',
                    color: 'var(--bg-card, #ffffff)',
                    ...style,
                }}
                className={cn(
                    'z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin)',
                    'rounded-md bg-fg-primary text-12-regular leading-snug text-bg-card shadow-md',
                    'px-3 py-1.5',
                    'animate-in fade-in-0 zoom-in-95',
                    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                    'data-[side=bottom]:slide-in-from-top-1',
                    'data-[side=left]:slide-in-from-right-1',
                    'data-[side=right]:slide-in-from-left-1',
                    'data-[side=top]:slide-in-from-bottom-1',
                    className,
                )}
                {...props}
            >
                {children}
                <TooltipArrow />
            </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
    );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipArrow };
