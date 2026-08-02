'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { UserAvatar } from '@/components/shared/user-avatar';
import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/client/trpc';
import { displayName, resolveAvatarUrl } from '@/lib/utils/user';

/**
 * Диалог добавления участника в закупку (без позиций).
 * Создаёт PurchaseOrder для выбранного пользователя; позиции добавляются
 * позже через «Добавить позицию» (orders.adminAdjust).
 *
 * `existingUserIds` — уже добавленные участники (скрываются как «добавлен»).
 */
interface AddParticipantDialogProps {
    purchaseId: number;
    existingUserIds: Set<number>;
}

type PickerUser = {
    id: number;
    firstName: string;
    lastName: string | null;
    username: string | null;
    phone: string | null;
    avatarUrl: string | null;
    telegramCredential: { username: string | null; avatarUrl: string | null } | null;
    vkCredential: { avatarUrl: string | null } | null;
};

export function AddParticipantDialog({ purchaseId, existingUserIds }: AddParticipantDialogProps) {
    const [open, setOpen] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const utils = trpc.useUtils();

    const { data: users, isLoading } = trpc.users.list.useQuery(undefined, { enabled: open });
    const addParticipant = trpc.orders.addParticipant.useMutation({
        onSuccess: () => {
            void utils.orders.getAllByPurchase.invalidate({ purchaseId });
            void utils.orders.getPurchaseOrdersByPurchase.invalidate({ purchaseId });
            void utils.purchases.getById.invalidate({ id: purchaseId });
            setOpen(false);
            setUserId(null);
        },
    });

    const options = useMemo<ComboboxOption<PickerUser>[]>(() => {
        const list = (users ?? []) as unknown as PickerUser[];
        return list.map((u) => {
            const name = displayName({ firstName: u.firstName, lastName: u.lastName });
            const tg = u.telegramCredential?.username ?? u.username;
            const phone = u.phone;
            // Label — для поиска (cmdk фильтрует по value/label) и для триггера.
            const parts = [name, tg ? `@${tg.replace(/^@/, '')}` : null, phone ?? null].filter(Boolean);
            return {
                value: String(u.id),
                label: parts.join(' · '),
                data: u,
            };
        });
    }, [users]);

    const selected = options.find((o) => o.value === userId) ?? null;

    const submit = () => {
        const id = Number(userId);
        if (!Number.isFinite(id)) return;
        addParticipant.mutate({ purchaseId, userId: id });
    };

    const reset = () => setUserId(null);

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                setOpen(o);
                if (!o) reset();
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Plus />
                    Добавить участника
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Добавить участника</DialogTitle>
                </DialogHeader>
                <div className="space-y-1">
                    <p className="text-13-regular text-fg-secondary">
                        Участник добавится без позиций. Товары можно добавить позже кнопкой «Добавить позицию».
                    </p>
                    <Combobox<PickerUser>
                        options={options}
                        value={userId ?? undefined}
                        onValueChange={(v) => setUserId(v)}
                        placeholder={isLoading ? 'Загрузка…' : 'Выберите участника'}
                        searchPlaceholder="Имя, @username или телефон…"
                        emptyText="Ничего не найдено"
                        isOptionDisabled={(o) => existingUserIds.has(Number(o.value))}
                        renderOption={(o) => <UserOption option={o} added={existingUserIds.has(Number(o.value))} />}
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Отмена</Button>
                    </DialogClose>
                    <Button onClick={submit} disabled={!selected || addParticipant.isPending}>
                        Добавить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Карточка опции: аватар + имя + @username, с бейджем «добавлен». */
function UserOption({
    option,
    added,
}: {
    option: ComboboxOption<PickerUser>;
    added: boolean;
}) {
    const u = option.data!;
    const name = displayName({ firstName: u.firstName, lastName: u.lastName });
    const tg = u.telegramCredential?.username ?? u.username;
    return (
        <span className="flex min-w-0 items-center gap-2">
            <UserAvatar src={resolveAvatarUrl(u)} className="size-6 shrink-0" iconClassName="size-3.5" />
            <span className="min-w-0 flex-1 truncate">
                <span className="text-fg-primary">{name}</span>
                {tg && <span className="text-fg-tertiary"> @{tg.replace(/^@/, '')}</span>}
            </span>
            {added && <span className="ml-auto shrink-0 text-12-regular text-fg-tertiary">добавлен</span>}
        </span>
    );
}
