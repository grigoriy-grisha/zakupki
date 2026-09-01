'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface PublishToTgDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    publishCount: number;
    isPending: boolean;
    onPublish: () => void;
}

export function PublishToTgDialog({ open, onOpenChange, publishCount, isPending, onPublish }: PublishToTgDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Опубликовать в Telegram?</DialogTitle>
                    <DialogDescription>
                        {publishCount > 0
                            ? `${publishCount} товаров будет опубликовано в канал Telegram.`
                            : 'Отметьте галочкой товары в таблице, которые нужно опубликовать.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button disabled={isPending || publishCount === 0} onClick={onPublish}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Опубликовать
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
