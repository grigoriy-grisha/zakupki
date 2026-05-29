import 'dotenv/config';
import { dbClient } from '@zakupki/database';

await dbClient.$connect();

const items = await dbClient.purchaseItem.findMany({
    where: { tgMessageId: { not: null } },
    select: {
        id: true,
        tgMessageId: true,
        tgChannelId: true,
        product: { select: { name: true } },
        purchase: { select: { tag: true, status: true } },
    },
});

console.log('Published items:', JSON.stringify(items, null, 2));

const users = await dbClient.user.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { telegramCredential: true, _count: { select: { orderLines: true } } },
});

console.log(
    'Recent users:',
    users.map((u) => ({
        id: u.id,
        name: u.firstName,
        tg: u.telegramCredential?.telegramId,
        orders: u._count.orderLines,
    })),
);

await dbClient.$disconnect();
