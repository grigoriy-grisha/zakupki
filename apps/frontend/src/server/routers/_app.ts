import { router } from '../trpc';
import { appSettingsRouter } from './app-settings';
import { attributeTypesRouter } from './attribute-types';
import { characteristicsRouter } from './characteristics';
import { ordersRouter } from './orders';
import { paymentsRouter } from './payments';
import { postTemplatesRouter } from './post-templates';
import { promoCodesRouter } from './promo-codes';
import { productAttributesRouter } from './product-attributes';
import { productsRouter } from './products';
import { purchasesRouter } from './purchases';
import { suppliersRouter } from './suppliers';
import { unitsRouter } from './units';
import { usersRouter } from './users';

export const appRouter = router({
    appSettings: appSettingsRouter,
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
