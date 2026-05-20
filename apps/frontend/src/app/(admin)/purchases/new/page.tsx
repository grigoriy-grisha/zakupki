'use client';

import { PurchaseForm } from './components';

export default function NewPurchasePage() {
    return (
        <div className="mx-auto max-w-lg space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Новая закупка</h1>
                <p className="mt-1 text-sm text-muted-foreground">Заполните данные для создания новой закупки</p>
            </div>

            <PurchaseForm />
        </div>
    );
}
