'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    variant?: 'destructive' | 'default';
    onConfirm: () => void;
    loading?: boolean;
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Удалить',
    variant = 'destructive',
    onConfirm,
    loading,
}: ConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button variant={variant} className="flex-1" onClick={onConfirm} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
