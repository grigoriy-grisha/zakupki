import { router } from '../trpc';
import { attributeTypesRouter } from './attributeTypes';
import { characteristicsRouter } from './characteristics';
import { ordersRouter } from './orders';
import { paymentsRouter } from './payments';
import { postTemplatesRouter } from './postTemplates';
import { promoCodesRouter } from './promoCodes';
import { productAttributesRouter } from './productAttributes';
import { productsRouter } from './products';
import { purchasesRouter } from './purchases';
import { suppliersRouter } from './suppliers';
import { unitsRouter } from './units';
import { usersRouter } from './users';

export const appRouter = router({
    attributeTypes: attributeTypesRouter,
    characteristics: characteristicsRouter,
    productAttributes: productAttributesRouter,
    products: productsRouter,
    purchases: purchasesRouter,
    suppliers: suppliersRouter,
    orders: ordersRouter,
    payments: paymentsRouter,
    postTemplates: postTemplatesRouter,
    promoCodes: promoCodesRouter,
    units: unitsRouter,
    users: usersRouter,
});

export type AppRouter = typeof appRouter;
