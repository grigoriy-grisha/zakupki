import { PaymentRepository } from '../domain/payment.repository';

export class PaymentService {
    constructor(private repo: PaymentRepository) {}

    async create(data: { userId: number; purchaseId: number; amount: number; note?: string }) {
        return this.repo.create(data);
    }

    async submitPayment(data: {
        userId: number;
        purchaseId: number;
        amount: number;
        userComment?: string;
        proofData?: Buffer;
        proofMimeType?: string;
        promoCodeId?: number;
        discountAmount?: number;
    }) {
        return this.repo.submitPayment(data);
    }

    async getByPurchase(purchaseId: number) {
        return this.repo.getByPurchase(purchaseId);
    }

    async getByUser(userId: number) {
        return this.repo.getByUser(userId);
    }

    async confirm(id: number, adminNote?: string) {
        return this.repo.updateStatus(id, 'CONFIRMED', adminNote);
    }

    async reject(id: number, adminNote?: string) {
        return this.repo.updateStatus(id, 'REJECTED', adminNote);
    }

    async cancel(id: number) {
        return this.repo.updateStatus(id, 'REJECTED');
    }

    async updatePayment(id: number, data: { amount?: number; userComment?: string; proofData?: Buffer; proofMimeType?: string }) {
        const updateData: { amount?: number; userComment?: string; proofData?: Buffer; proofMimeType?: string; status: string; adminNote: null } = {
            status: 'PENDING',
            adminNote: null,
        };
        if (data.amount !== undefined) updateData.amount = data.amount;
        if (data.userComment !== undefined) updateData.userComment = data.userComment;
        if (data.proofData !== undefined) updateData.proofData = data.proofData;
        if (data.proofMimeType !== undefined) updateData.proofMimeType = data.proofMimeType;
        return this.repo.update(id, updateData);
    }
}
