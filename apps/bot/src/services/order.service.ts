import type { PrismaClient } from '@zakupki/database';
import { OrderRepository } from '../domain/repositories/order.repository';

export class OrderService {
    private repo: OrderRepository;

    constructor(db: PrismaClient) {
        this.repo = new OrderRepository(db);
    }

    async getUserOrders(userId: number) {
        const orders = await this.repo.findByUserId(userId);

        const lines = orders.map((o) => {
            const product = o.purchaseItem?.product;
            const purchase = o.purchaseItem?.purchase;
            const shortName = product?.unit?.shortName ?? '';
            return (
                `📦 ${product?.name ?? 'Товар'}\n` +
                `   Закупка: ${purchase?.tag ?? '—'} · ${Number(o.quantity).toLocaleString('ru-RU')} ${shortName}\n` +
                `   Сумма: ${Number(o.amountDue).toLocaleString('ru-RU')} ₽`
            );
        });

        const total = orders.reduce((s, o) => s + Number(o.amountDue), 0);

        return { orders, lines, total };
    }
}
