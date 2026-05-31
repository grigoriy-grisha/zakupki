import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
const prisma = new PrismaClient({ adapter });

async function main() {
    await prisma.orderLine.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.purchaseItem.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.promoCode.deleteMany();
    await prisma.productAttributeCharacteristic.deleteMany();
    await prisma.productAttributeValue.deleteMany();
    await prisma.productPhoto.deleteMany();
    await prisma.product.deleteMany();
    await prisma.productAttribute.deleteMany();
    await prisma.attributeType.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.telegramCredential.deleteMany();
    await prisma.vkCredential.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.postTemplate.deleteMany();
    await prisma.productCharacteristicValue.deleteMany();
    await prisma.characteristic.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.supplier.deleteMany();

    await prisma.role.createMany({
        data: [{ kind: 'ADMIN' }, { kind: 'CLIENT' }],
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
