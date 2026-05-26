import { router } from '../trpc';
import { categoriesRouter } from './categories';
import { ordersRouter } from './orders';
import { paymentsRouter } from './payments';
import { promoCodesRouter } from './promoCodes';
import { productsRouter } from './products';
import { purchasesRouter } from './purchases';
import { unitsRouter } from './units';
import { usersRouter } from './users';

export const appRouter = router({
    categories: categoriesRouter,
    products: productsRouter,
    purchases: purchasesRouter,
    orders: ordersRouter,
    payments: paymentsRouter,
    promoCodes: promoCodesRouter,
    units: unitsRouter,
    users: usersRouter,
});

export type AppRouter = typeof appRouter;
