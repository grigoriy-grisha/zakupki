'use client';

import type { NotificationIconKind, NotificationTone } from '@zakupki/types';
import {
    CheckCircle2,
    CircleSlash,
    Flag,
    ListChecks,
    PackageCheck,
    PackageX,
    RefreshCw,
} from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Maps a notification's iconographic kind to a lucide icon and its tone to a
 * Tailwind color class. Used by both the bell popover and the notifications
 * page so the visual language is consistent.
 *
 * Tones map to the same tokens used elsewhere in the app:
 *   success → green, critical → red, warning → amber,
 *   accent  → brand/primary, neutral → muted gray.
 */

const ICONS: Record<NotificationIconKind, typeof CheckCircle2> = {
    'payment-success': CheckCircle2,
    'payment-fail': CircleSlash,
    'order-edit': ListChecks,
    'order-remove': PackageX,
    handoff: PackageCheck,
    stage: Flag,
    status: RefreshCw,
};

const TONE_ICON: Record<NotificationTone, string> = {
    success: 'text-success',
    critical: 'text-error',
    warning: 'text-warning',
    accent: 'text-primary',
    neutral: 'text-fg-secondary',
};

const TONE_BG: Record<NotificationTone, string> = {
    success: 'bg-success/10',
    critical: 'bg-error/10',
    warning: 'bg-warning/10',
    accent: 'bg-primary/10',
    neutral: 'bg-bg-soft',
};

const TONE_BORDER: Record<NotificationTone, string> = {
    success: 'border-success/20',
    critical: 'border-error/20',
    warning: 'border-warning/20',
    accent: 'border-primary/20',
    neutral: 'border-border',
};

interface NotificationIconProps {
    icon: NotificationIconKind;
    tone: NotificationTone;
    /** Diameter of the circular tile in Tailwind units. Default: h-9 w-9. */
    size?: 'sm' | 'md';
}

export function NotificationIconTile({ icon, tone, size = 'md' }: NotificationIconProps) {
    const Icon = ICONS[icon];
    const dim = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
    const iconDim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
    return (
        <div
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full',
                dim,
                TONE_BG[tone],
            )}
        >
            <Icon className={cn(iconDim, TONE_ICON[tone])} />
        </div>
    );
}

/** Exported so the page can tint its card border by tone. */
export function toneBorderClass(tone: NotificationTone): string {
    return TONE_BORDER[tone];
}
