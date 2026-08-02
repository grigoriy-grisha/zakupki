import { CheckCircle2Icon, ClockIcon, OctagonXIcon, Undo2Icon, XCircleIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/components/ui/badge';

type StatusKey = 'succeeded' | 'completed' | 'pending' | 'processing' | 'failed' | 'cancelled' | 'refunded' | 'active' | 'inactive';

const STATUS_PRESETS: Record<
    StatusKey,
    { label: string; variant: BadgeVariant; icon?: React.ComponentType<{ className?: string }> }
> = {
    succeeded: { label: 'Успешно', variant: 'success', icon: CheckCircle2Icon },
    completed: { label: 'Завершено', variant: 'success', icon: CheckCircle2Icon },
    active: { label: 'Активно', variant: 'success', icon: CheckCircle2Icon },
    pending: { label: 'Ожидание', variant: 'warning', icon: ClockIcon },
    processing: { label: 'В обработке', variant: 'warning', icon: ClockIcon },
    failed: { label: 'Ошибка', variant: 'critical', icon: OctagonXIcon },
    cancelled: { label: 'Отменено', variant: 'critical', icon: XCircleIcon },
    inactive: { label: 'Неактивно', variant: 'neutral' },
    refunded: { label: 'Возврат', variant: 'warning', icon: Undo2Icon },
};

function StatusBadge({ status, label, className }: { status: string; label?: string; className?: string }) {
    const preset = STATUS_PRESETS[status as StatusKey] ?? {
        label: status,
        variant: 'neutral' as BadgeVariant,
    };
    const Icon = preset.icon;
    return (
        <Badge variant={preset.variant} type="subtle" size="default" className={className}>
            {Icon && <Icon className="size-3" />}
            {label ?? preset.label}
        </Badge>
    );
}

export { StatusBadge };
