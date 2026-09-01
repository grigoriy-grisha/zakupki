'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/client/trpc';
import { mutationOptions } from '@/lib/query/mutation-options';

import { USER_ROLE_LABELS } from '../../lib/constants';

type UserRole = 'ADMIN' | 'CLIENT';

interface UserRoleSelectProps {
    userId: number;
    role: UserRole;
}

export function UserRoleSelect({ userId, role }: UserRoleSelectProps) {
    const utils = trpc.useUtils();
    const updateRole = trpc.users.updateRole.useMutation(
        mutationOptions({
            invalidate: () => void utils.users.list.invalidate(),
            success: 'Роль обновлена',
        }),
    );

    return (
        <Select
            value={role}
            disabled={updateRole.isPending}
            onValueChange={(value) => {
                if (value === role) return;
                updateRole.mutate({ userId, role: value as UserRole });
            }}
        >
            <SelectTrigger className="h-8 w-[140px] bg-bg-base" onClick={(e) => e.stopPropagation()}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {(Object.keys(USER_ROLE_LABELS) as UserRole[]).map((roleKey) => (
                    <SelectItem key={roleKey} value={roleKey}>
                        {USER_ROLE_LABELS[roleKey]}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
