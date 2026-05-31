'use client';

import { ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { resolveAvatarUrl, displayName } from '@/lib/utils/user';

import { type UserListItem } from './user-profile-sheet';

interface UserOrdersRowProps {
    user: UserListItem;
    onOpenProfile: (user: UserListItem) => void;
}

export function UserOrdersRow({ user, onOpenProfile }: UserOrdersRowProps) {
    const name = displayName(user);
    const avatarUrl = resolveAvatarUrl(user);
    const tgUsername = user.telegramCredential?.username ?? user.username;

    return (
        <TableRow
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onOpenProfile(user)}
        >
            <TableCell>
                <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {name.charAt(0)}
                        </div>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <p className="font-medium">{name}</p>
                {tgUsername && (
                    <p className="text-xs text-muted-foreground">@{tgUsername.replace(/^@/, '')}</p>
                )}
            </TableCell>
            <TableCell>
                <Badge variant="secondary" className="font-normal">
                    {user.orderLines.length} заказов
                </Badge>
            </TableCell>
        </TableRow>
    );
}
