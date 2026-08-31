import { err, forbidden, type MultiUpdate } from './atomic';
import { PaymentPlusStrategy } from './payment-plus-strategy';

export class OrderingClosedStrategy extends PaymentPlusStrategy {
    override adjust(userId: number, delta: number): MultiUpdate {
        if (delta > 0) return err(forbidden('Приём заказов завершён'));
        return super.adjust(userId, delta);
    }
}
