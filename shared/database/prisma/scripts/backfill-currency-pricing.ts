/**
 * Backfill-скрипт: перенос существующих товаров закупок на новую модель цен
 * (валюта + курс + оргсбор). Запускается вручную после миграции
 * `add_currency_and_item_pricing_fields`.
 *
 * Что делает (idempotent — повторный запуск безопасен):
 *  1. Создаёт валюту «Рубль» (RUB, ₽), если её нет.
 *  2. Для каждой закупки, где есть товары с supplierPackagePrice, создаёт
 *     PurchaseCurrencyRate(purchase, RUB, rateToRub = 1.0) — старая цена уже в ₽.
 *  3. Копирует в новые поля (только если они ещё null):
 *       supplierPackagePrice  → pricePerPackCurrency
 *       supplierPackageAmount → packAmount
 *       supplierPackageUnit   → packUnit
 *       currencyId            → id рубля
 *
 * Товары только на ценовых тирах (без supplierPackagePrice) НЕ переносятся —
 * их требуется переоценить вручную. Скрипт выводит их количество для контроля.
 *
 * Запуск: pnpm --filter @zakupki/database exec tsx prisma/scripts/backfill-currency-pricing.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// dbClient (src/database.ts) читает DATABASE_URL синхронно на верхнем уровне
// при импорте, но ищет только .env.local. Подгружаем корневой .env (как
// prisma.config.ts) ДО импорта dbClient, чтобы адаптер получил connectionString.
for (const envPath of [path.join(__dirname, '../../../.env'), path.join(process.cwd(), '.env')]) {
    config({ path: envPath });
}

interface BackfillReport {
    rubleCurrencyId: number;
    purchasesWithRates: number;
    itemsMigrated: number;
    itemsOnTiersOnly: number;
}

async function backfillCurrencyPricing(): Promise<BackfillReport> {
    const { dbClient: db } = await import('../../src/database');

    // 1. Рубль по умолчанию.
    const ruble = await db.currency.upsert({
        where: { name: 'Рубль' },
        update: {},
        create: { name: 'Рубль', code: 'RUB', symbol: '₽', position: 0 },
    });

    // 2. Закупки, где есть товары с ценой упаковки (старая цена в ₽).
    const purchaseIds = await db.purchaseItem.findMany({
        where: { supplierPackagePrice: { not: null } },
        select: { purchaseId: true },
        distinct: ['purchaseId'],
    });

    let purchasesWithRates = 0;
    for (const { purchaseId } of purchaseIds) {
        // upsert по unique(purchaseId, currencyId) — idempotent.
        await db.purchaseCurrencyRate.upsert({
            where: { purchaseId_currencyId: { purchaseId, currencyId: ruble.id } },
            update: {},
            create: { purchaseId, currencyId: ruble.id, rateToRub: 1 },
        });
        purchasesWithRates += 1;
    }

    // 3. Копирование старых полей в новые (только где новые ещё null).
    const itemsWithPrice = await db.purchaseItem.findMany({
        where: {
            supplierPackagePrice: { not: null },
            pricePerPackCurrency: null, // не переносим повторно
        },
        select: {
            id: true,
            supplierPackagePrice: true,
            supplierPackageAmount: true,
            supplierPackageUnit: true,
            packAmount: true,
        },
    });

    let itemsMigrated = 0;
    for (const item of itemsWithPrice) {
        await db.purchaseItem.update({
            where: { id: item.id },
            data: {
                pricePerPackCurrency: item.supplierPackagePrice,
                packAmount: item.packAmount ?? item.supplierPackageAmount,
                packUnit: item.supplierPackageUnit,
                currencyId: ruble.id,
            },
        });
        itemsMigrated += 1;
    }

    // Контроль: товары без цены упаковки и не перенесённые — требуют ручной
    // переоценки (это товары только на ценовых тирах priceTiers).
    const itemsOnTiersOnly = await db.purchaseItem.count({
        where: {
            supplierPackagePrice: null,
            pricePerPackCurrency: null,
        },
    });

    return { rubleCurrencyId: ruble.id, purchasesWithRates, itemsMigrated, itemsOnTiersOnly };
}

async function main(): Promise<void> {
    console.log('Backfill: старт переноса цен на новую модель (валюта + курс)...');
    const report = await backfillCurrencyPricing();

    console.log(`  • Валюта «Рубль»: id=${report.rubleCurrencyId}`);
    console.log(`  • Закупок с курсом RUB=1.0: ${report.purchasesWithRates}`);
    console.log(`  • Товаров перенесено: ${report.itemsMigrated}`);
    console.log(
        `  • Товаров только на тирах (требуют ручной переоценки): ${report.itemsOnTiersOnly}`,
    );
    console.log('Backfill: готово.');

    const { dbClient: db } = await import('../../src/database');
    await db.$disconnect();
}

main().catch((error) => {
    console.error('Backfill: ошибка:', error);
    process.exitCode = 1;
});
