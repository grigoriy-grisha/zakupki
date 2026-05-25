import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
const prisma = new PrismaClient({ adapter });

async function main() {
    // Clean up
    await prisma.orderLine.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.purchaseItem.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.productPhoto.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
    await prisma.unit.deleteMany();

    // Units
    const gramUnit = await prisma.unit.create({
        data: { name: 'Граммы', shortName: 'г', multiplicity: 5 },
    });
    const pieceUnit = await prisma.unit.create({
        data: { name: 'Штуки', shortName: 'шт', multiplicity: 1 },
    });

    // Products
    const p1 = await prisma.product.create({
        data: {
            name: 'MIYUKI 11/0 Black',
            description: 'Японский бисер MIYUKI Delica 11/0, цвет Black',
            unitId: gramUnit.id,
            pricePerUnit: 120,
            brand: 'MIYUKI',
            sku: 'MIY-11-BLK',
        },
    });

    const p2 = await prisma.product.create({
        data: {
            name: 'TOHO 8/0 Silver',
            description: 'Японский бисер TOHO 8/0, цвет Silver',
            unitId: gramUnit.id,
            pricePerUnit: 95,
            brand: 'TOHO',
            sku: 'TOH-8-SLV',
        },
    });

    const p3 = await prisma.product.create({
        data: {
            name: 'Фурнитура застёжка магнитная',
            description: 'Магнитная застёжка для украшений, серебро',
            unitId: pieceUnit.id,
            pricePerUnit: 45,
            brand: 'Generic',
            sku: 'FUR-MAG-S',
        },
    });

    // Purchase
    const purchase = await prisma.purchase.create({
        data: {
            tag: 'СЗ7',
            title: 'Закупка бисера #7',
            status: 'ACTIVE',
            minAmount: 5000,
            deadline: new Date('2026-06-15'),
        },
    });

    // Purchase items
    const pi1 = await prisma.purchaseItem.create({
        data: {
            purchaseId: purchase.id,
            productId: p1.id,
            priceOverride: 120,
            minQty: 10,
        },
    });

    const pi2 = await prisma.purchaseItem.create({
        data: {
            purchaseId: purchase.id,
            productId: p2.id,
            priceOverride: 95,
            minQty: 10,
        },
    });

    // Users
    const users = await Promise.all([
        prisma.user.create({
            data: {
                firstName: 'Анна',
                username: 'anna_beads',
                telegramCredential: { create: { telegramId: '100000001', username: 'anna_beads' } },
            },
        }),
        prisma.user.create({
            data: {
                firstName: 'Мария',
                lastName: 'Иванова',
                username: 'maria_craft',
                telegramCredential: { create: { telegramId: '100000002', username: 'maria_craft' } },
            },
        }),
        prisma.user.create({
            data: {
                firstName: 'Ольга',
                username: 'olga_jewelry',
                telegramCredential: { create: { telegramId: '100000003', username: 'olga_jewelry' } },
            },
        }),
        prisma.user.create({
            data: {
                firstName: 'Елена',
                lastName: 'Петрова',
                username: 'elena_art',
                telegramCredential: { create: { telegramId: '100000004', username: 'elena_art' } },
            },
        }),
        prisma.user.create({
            data: {
                firstName: 'Наталья',
                username: 'nat_beads',
                telegramCredential: { create: { telegramId: '100000005', username: 'nat_beads' } },
            },
        }),
    ]);

    // Order lines
    await prisma.orderLine.createMany({
        data: [
            { purchaseItemId: pi1.id, userId: users[0].id, quantity: 50, amountDue: 6000 },
            { purchaseItemId: pi1.id, userId: users[1].id, quantity: 30, amountDue: 3600 },
            { purchaseItemId: pi1.id, userId: users[2].id, quantity: 20, amountDue: 2400 },
            { purchaseItemId: pi2.id, userId: users[0].id, quantity: 40, amountDue: 3800 },
            { purchaseItemId: pi2.id, userId: users[3].id, quantity: 25, amountDue: 2375 },
        ],
    });

    console.log('Seed completed successfully');
    console.log(`Units: 2, Products: 3, Purchase: 1, Users: ${users.length}, Order lines: 5`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
