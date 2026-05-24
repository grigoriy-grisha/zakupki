import type { AppRoute } from '@/lib/types';

export const VK_USER_INFO_URL = 'https://id.vk.com/oauth2/user_info';

export const ROUTES = {
    login: { path: '/login', label: 'Вход' },
    home: { path: '/', label: 'Dashboard' },
    purchases: { path: '/purchases', label: 'Закупки' },
    purchasesNew: { path: '/purchases/new', label: 'Новая закупка' },
    products: { path: '/products', label: 'Каталог товаров' },
    users: { path: '/users', label: 'Участники' },
    settings: { path: '/settings', label: 'Настройки' },
    shop: { path: '/shop', label: 'Мои закупки' },
} as const satisfies Record<string, AppRoute>;

export const API_ROUTES = {
    auth: '/api/auth',
    trpc: '/api/trpc',
    upload: '/api/upload',
    photo: (id: number) => `/api/photos/${id}`,
    paymentProof: (id: number) => `/api/payment-proof/${id}`,
} as const;

export const APP_PAGE_PATHS = [
    ROUTES.login.path,
    ROUTES.home.path,
    ROUTES.purchases.path,
    ROUTES.purchasesNew.path,
    `${ROUTES.purchases.path}/[id]`,
    ROUTES.products.path,
    ROUTES.users.path,
    ROUTES.settings.path,
    ROUTES.shop.path,
    `${ROUTES.shop.path}/purchase/[id]`,
] as const;

export const PUBLIC_PATH_PREFIXES = [
    ROUTES.login.path,
    API_ROUTES.auth,
    API_ROUTES.trpc,
] as const;

export const ADMIN_ONLY_PREFIXES = [
    ROUTES.home.path,
    ROUTES.purchases.path,
    ROUTES.products.path,
    ROUTES.users.path,
    ROUTES.settings.path,
] as const;

export const ADMIN_NAV_ITEMS: readonly AppRoute[] = [
    ROUTES.home,
    ROUTES.purchases,
    ROUTES.products,
    ROUTES.users,
    ROUTES.settings,
    ROUTES.shop,
];

export const CLIENT_NAV_ITEMS: readonly AppRoute[] = [ROUTES.shop];
