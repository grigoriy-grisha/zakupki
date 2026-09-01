'use client';

import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Highlight } from '@/components/shared/highlight';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function CommentCell({
    value,
    query = '',
    onCommit,
}: {
    value: string | null | undefined;
    query?: string;
    onCommit: (next: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value ?? '');

    useEffect(() => {
        if (open) setDraft(value ?? '');
    }, [open, value]);

    function handleSave() {
        const trimmed = draft.trim();
        if (trimmed !== (value ?? '')) onCommit(trimmed);
        setOpen(false);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-12-regular text-fg-secondary hover:bg-bg-soft"
                aria-label="Редактировать комментарий"
            >
                <Pencil className="size-3 shrink-0 text-fg-tertiary" />
                <span className="truncate">{value ? <Highlight text={value} query={query} /> : '—'}</span>
            </button>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Комментарий</DialogTitle>
                </DialogHeader>
                <Textarea
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Введите комментарий…"
                    className="min-h-[160px] resize-y"
                />
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Отмена
                    </Button>
                    <Button onClick={handleSave}>Сохранить</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
