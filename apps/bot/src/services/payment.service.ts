import type { PrismaClient } from '@zakupki/database';
import { PaymentRepository } from '../domain/repositories/payment.repository';
import { PAYMENT_STATUS } from '../domain/constants';

export class PaymentService {
    private repo: PaymentRepository;

    constructor(db: PrismaClient) {
        this.repo = new PaymentRepository(db);
    }

    async getUserPayments(userId: number) {
        const payments = await this.repo.findByUserId(userId);

        const lines = payments.map((p) => {
            const childAmount = (p.children ?? []).reduce((s, c) => s + Number(c.amount), 0);
            const total = Number(p.amount) + childAmount;
            const { emoji = '❓', label = p.status } = PAYMENT_STATUS[p.status] ?? {};
            return (
                `${emoji} ${total.toLocaleString('ru-RU')} ₽ — ${p.purchase?.tag ?? '—'}\n` +
                `   ${label} · ${new Date(p.paidAt).toLocaleDateString('ru-RU')}`
            );
        });

        return { payments, lines };
    }
}
