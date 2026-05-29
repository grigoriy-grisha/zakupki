import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client';

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
    await prisma.category.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.telegramCredential.deleteMany();
    await prisma.vkCredential.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.postTemplate.deleteMany();
    await prisma.productCharacteristicValue.deleteMany();
    await prisma.characteristic.deleteMany();
    await prisma.unit.deleteMany();

    await prisma.role.createMany({
        data: [{ kind: 'ADMIN' }, { kind: 'CLIENT' }],
    });

    await prisma.unit.createMany({
        data: [
            { name: 'Граммы', shortName: 'г', multiplicity: 1 },
            { name: 'Штуки', shortName: 'шт', multiplicity: 1 },
            { name: 'Туба', shortName: 'туба', multiplicity: 1 },
        ],
    });

    await prisma.characteristic.createMany({
        data: [
            { name: 'Цвет', position: 0 },
            { name: 'Размер', position: 1 },
            { name: 'Длина', position: 2 },
            { name: 'Упаковка', position: 3 },
            { name: 'Страна производитель', position: 4 },
        ],
    });

    // Структура каталога (типы атрибутов) задаётся пользователем в настройках.
    console.log('Seed completed: roles (2), units (3), characteristics (5)');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
