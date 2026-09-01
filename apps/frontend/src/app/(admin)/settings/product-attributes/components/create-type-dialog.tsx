'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useCreateAttributeType } from '../hooks';

interface CreateTypeDialogProps {
    parentId?: number | null;
    parentName?: string;
    trigger: React.ReactNode;
}

export function CreateTypeDialog({ parentId = null, parentName, trigger }: CreateTypeDialogProps) {
    const createType = useCreateAttributeType();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [showInTitle, setShowInTitle] = useState(true);

    function resetForm() {
        setName('');
        setShowInTitle(true);
    }

    function handleCreate() {
        const trimmed = name.trim();
        if (!trimmed) return;
        createType.mutate(
            { name: trimmed, parentId, showInTitle },
            {
                onSuccess: () => {
                    resetForm();
                    setOpen(false);
                },
            },
        );
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) resetForm();
            }}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{parentName ? `Подтип для «${parentName}»` : 'Новый тип атрибута'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="create-attr-type">Название</Label>
                        <Input
                            id="create-attr-type"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            placeholder={parentName ? 'Например: Размер' : 'Например: Производитель'}
                            autoFocus
                        />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-14-regular text-fg-secondary">
                        <Checkbox checked={showInTitle} onCheckedChange={(v) => setShowInTitle(v === true)} />
                        Включать в заголовок описания
                    </label>
                    <Button onClick={handleCreate} disabled={!name.trim() || createType.isPending} className="w-full">
                        {createType.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Создать
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
