'use client';

import { Loader2,Plus } from 'lucide-react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { PostTemplatePlaceholdersHint } from './components/post-template-placeholders-hint';
import { PostTemplateRow } from './components/post-template-row';
import { useCreatePostTemplate, useDeletePostTemplate, usePostTemplateList } from './hooks';

export function PostTemplatesTab() {
    const { data: templates, isLoading } = usePostTemplateList();
    const createMutation = useCreatePostTemplate();
    const deleteMutation = useDeletePostTemplate();
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

    function handleCreate() {
        const trimmed = newName.trim();
        if (!trimmed) return;
        createMutation.mutate(
            { name: trimmed, body: '' },
            {
                onSuccess: () => {
                    setNewName('');
                    setCreateOpen(false);
                },
            },
        );
    }

    if (isLoading) {
        return <div className="py-8 text-center text-fg-secondary">Загрузка...</div>;
    }

    return (
        <div className="space-y-4 pt-4">
            <div className="flex justify-end">
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="mr-2 size-4" />
                    Добавить шаблон
                </Button>
            </div>

            <PostTemplatePlaceholdersHint />

            {templates?.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center text-14-regular text-fg-secondary">
                    Шаблонов пока нет
                </div>
            ) : (
                <div className="space-y-2">
                    {templates?.map((t: { id: number; name: string; body: string }) => (
                        <PostTemplateRow
                            key={t.id}
                            template={t}
                            onDelete={() => setDeleteTarget({ id: t.id, name: t.name })}
                        />
                    ))}
                </div>
            )}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Новый шаблон поста</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-template-name">Название</Label>
                            <Input
                                id="new-template-name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                placeholder="Например: Стандартный пост"
                                autoFocus
                            />
                        </div>
                        <Button
                            className="w-full"
                            disabled={!newName.trim() || createMutation.isPending}
                            onClick={handleCreate}
                        >
                            {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Создать
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Удалить шаблон"
                description={
                    <>
                        Удалить шаблон <strong>{deleteTarget?.name}</strong>?
                    </>
                }
                onConfirm={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
                loading={deleteMutation.isPending}
            />
        </div>
    );
}
