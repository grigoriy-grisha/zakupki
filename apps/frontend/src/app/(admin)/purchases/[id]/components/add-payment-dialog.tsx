'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAddManualPayment } from '../hooks';
import type { AddPaymentDialogProps } from '../../../lib/types';

export function AddPaymentDialog({ purchaseId }: AddPaymentDialogProps) {
    const [open, setOpen] = useState(false);
    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');

    const addPayment = useAddManualPayment(purchaseId);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        addPayment.mutate(
            {
                userId: Number(userId),
                purchaseId,
                amount: Number(amount),
                note: note || undefined,
            },
            {
                onSuccess: () => {
                    setOpen(false);
                    setUserId('');
                    setAmount('');
                    setNote('');
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Plus className="h-4 w-4" />
                    Добавить оплату
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Добавить оплату вручную</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>ID пользователя</Label>
                        <Input type="number" value={userId} onChange={(e) => setUserId(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Сумма (₽)</Label>
                        <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Примечание</Label>
                        <Input value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <Button type="submit" disabled={addPayment.isPending} className="w-full">
                        {addPayment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Добавить
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
