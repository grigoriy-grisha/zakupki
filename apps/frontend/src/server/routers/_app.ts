import { router } from '../trpc';
import { analyticsRouter } from './analytics';
import { attributeTypesRouter } from './attribute-types';
import { characteristicsRouter } from './characteristics';
import { currenciesRouter } from './currencies';
import { notificationsRouter } from './notifications';
import { ordersRouter } from './orders';
import { paymentsRouter } from './payments';
import { postTemplatesRouter } from './post-templates';
import { productAttributesRouter } from './product-attributes';
import { productsRouter } from './products';
import { promoCodesRouter } from './promo-codes';
import { purchasesRouter } from './purchases';
import { settingsRouter } from './settings';
import { suppliersRouter } from './suppliers';
import { usersRouter } from './users';

export const appRouter = router({
    analytics: analyticsRouter,
    attributeTypes: attributeTypesRouter,
    characteristics: characteristicsRouter,
    productAttributes: productAttributesRouter,
    products: productsRouter,
    purchases: purchasesRouter,
    settings: settingsRouter,
    suppliers: suppliersRouter,
    currencies: currenciesRouter,
    orders: ordersRouter,
    payments: paymentsRouter,
    postTemplates: postTemplatesRouter,
    promoCodes: promoCodesRouter,
    users: usersRouter,
    notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
