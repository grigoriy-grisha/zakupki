'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { FormSection } from '@/components/ui/form-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

import { trpc } from '@/lib/client/trpc';
import { cn } from '@/lib/utils';

interface SupplierSectionProps {
    supplierId: number | null;
    onChange: (value: number | null) => void;
}

/** Секция выбора поставщика. */
export function SupplierSection({ supplierId, onChange }: SupplierSectionProps) {
    const { data: suppliers } = trpc.suppliers.list.useQuery();
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newContact, setNewContact] = useState('');
    const utils = trpc.useUtils();
    const createMutation = trpc.suppliers.create.useMutation({
        onSuccess: (created) => {
            void utils.suppliers.list.invalidate();
            toast.success('Поставщик создан');
            onChange(created.id);
            setCreateOpen(false);
            setNewName('');
            setNewContact('');
        },
        onError: (err: { message: string }) => toast.error(err.message),
    });

    const list = (suppliers ?? []) as { id: number; name: string }[];
    const current = list.find((s) => s.id === supplierId);

    function handleCreate() {
        const trimmed = newName.trim();
        if (!trimmed) return;
        createMutation.mutate({ name: trimmed, contact: newContact.trim() || undefined });
    }

    return (
        <FormSection card title="Поставщик">
            <div className="flex flex-wrap items-center gap-2">
                {list.length === 0 && (
                    <p className="text-12-regular text-fg-tertiary">
                        Поставщиков пока нет — создайте первого.
                    </p>
                )}
                {list.map((s) => {
                    const active = s.id === supplierId;
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => onChange(active ? null : s.id)}
                            className={cn(
                                'group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-13-medium transition-colors',
                                active
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border bg-bg-card text-fg-secondary hover:border-border-strong hover:text-fg-primary',
                            )}
                        >
                            {s.name}
                            {active && <X className="h-3 w-3" />}
                        </button>
                    );
                })}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setCreateOpen(true)}
                >
                    <Plus className="h-3.5 w-3.5" />
                    Новый поставщик
                </Button>
            </div>
            {current && (
                <p className="text-12-regular text-fg-tertiary">
                    Выбран: <strong>{current.name}</strong>. Будет использован в плейсхолдере{' '}
                    <code className="rounded bg-muted px-1 text-11-medium">{`{{поставщик}}`}</code>.
                </p>
            )}
            <p className="text-12-regular text-fg-tertiary">
                Опционально. Используется в шаблоне поста и для разделения одинаковых товаров с разными ценами.
            </p>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Новый поставщик</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="supplier-name">Название</Label>
                            <Input
                                id="supplier-name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Например: Поставщик 1"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="supplier-contact">Контакт (опц.)</Label>
                            <Input
                                id="supplier-contact"
                                value={newContact}
                                onChange={(e) => setNewContact(e.target.value)}
                                placeholder="Телеграм / телефон / email"
                            />
                        </div>
                        <Button
                            type="button"
                            className="w-full"
                            disabled={!newName.trim() || createMutation.isPending}
                            onClick={handleCreate}
                        >
                            {createMutation.isPending ? 'Создание…' : 'Создать'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </FormSection>
    );
}
