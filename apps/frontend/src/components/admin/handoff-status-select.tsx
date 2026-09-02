'use client';

import { HANDOFF_DEFAULT_LABEL, HANDOFF_STATUS_LABELS, type HandoffStatus } from '@zakupki/types';
import { Archive, Check, ChevronDown, Clock, PackageCheck, Truck } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface HandoffOption {
    value: HandoffStatus | null;
    label: string;
    icon: typeof Clock;
    itemClass: string;
    triggerClass: string;
}

const OPTIONS: HandoffOption[] = [
    {
        value: null,
        label: HANDOFF_DEFAULT_LABEL,
        icon: Clock,
        itemClass: 'text-fg-secondary',
        triggerClass: 'border-border bg-bg-card text-fg-secondary',
    },
    {
        value: 'SENT',
        label: HANDOFF_STATUS_LABELS.SENT,
        icon: Truck,
        itemClass: 'text-secondary',
        triggerClass: 'border-secondary/30 bg-secondary/10 text-secondary',
    },
    {
        value: 'RECEIVED',
        label: HANDOFF_STATUS_LABELS.RECEIVED,
        icon: PackageCheck,
        itemClass: 'text-success',
        triggerClass: 'border-success/30 bg-success-50 text-success',
    },
    {
        value: 'STORED',
        label: HANDOFF_STATUS_LABELS.STORED,
        icon: Archive,
        itemClass: 'text-warning',
        triggerClass: 'border-warning/30 bg-warning-50 text-warning',
    },
];

interface HandoffStatusSelectProps {
    value: HandoffStatus | null;
    disabled?: boolean;
    onSelect: (status: HandoffStatus | null) => void;
}

export function HandoffStatusSelect({ value, disabled = false, onSelect }: HandoffStatusSelectProps) {
    const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0]!;
    const CurrentIcon = current.icon;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={disabled}
                aria-label="Статус выдачи заказа"
                className={cn(
                    'inline-flex h-7 max-w-44 items-center gap-1 rounded-full border px-2.5 text-12-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                    current.triggerClass,
                )}
            >
                <CurrentIcon className="size-3 shrink-0" />
                <span className="truncate">{current.label}</span>
                <ChevronDown className="size-3 shrink-0 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
                {OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = option.value === value;
                    return (
                        <DropdownMenuItem
                            key={option.label}
                            disabled={disabled}
                            onClick={() => onSelect(option.value)}
                            className={cn('gap-2', option.itemClass)}
                        >
                            <Icon className="size-3.5 shrink-0" />
                            <span className="flex-1">{option.label}</span>
                            {active && <Check className="size-3.5 shrink-0" />}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
