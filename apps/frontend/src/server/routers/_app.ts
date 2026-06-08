import { router } from '../trpc';
import { attributeTypesRouter } from './attribute-types';
import { characteristicsRouter } from './characteristics';
import { ordersRouter } from './orders';
import { paymentsRouter } from './payments';
import { postTemplatesRouter } from './post-templates';
import { promoCodesRouter } from './promo-codes';
import { productAttributesRouter } from './product-attributes';
import { productsRouter } from './products';
import { purchasesRouter } from './purchases';
import { settingsRouter } from './settings';
import { usersRouter } from './users';

export const appRouter = router({
    attributeTypes: attributeTypesRouter,
    characteristics: characteristicsRouter,
    productAttributes: productAttributesRouter,
    products: productsRouter,
    purchases: purchasesRouter,
    settings: settingsRouter,
    orders: ordersRouter,
    payments: paymentsRouter,
    postTemplates: postTemplatesRouter,
    promoCodes: promoCodesRouter,
    users: usersRouter,
});

export type AppRouter = typeof appRouter;
