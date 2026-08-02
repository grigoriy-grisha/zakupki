import { z } from 'zod';

export const USER_ROLES = {
    ADMIN: 'ADMIN',
    CLIENT: 'CLIENT',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const rbacConfigSchema = () =>
    z.object({
        canAccessAdminPanel: z.boolean().default(false),
        canManagePurchases: z.boolean().default(false),
        canManageProducts: z.boolean().default(false),
        canManageUsers: z.boolean().default(false),
        canManageSettings: z.boolean().default(false),
        canViewPayments: z.boolean().default(false),
        canExportData: z.boolean().default(false),
        canShop: z.boolean().default(false),
    });

export type RbacConfig = z.infer<ReturnType<typeof rbacConfigSchema>>;

type RbacRoleMap = Record<UserRole, RbacConfig>;

const c = (config: Partial<RbacConfig>) => rbacConfigSchema().parse(config);

export const RBAC: RbacRoleMap = {
    [USER_ROLES.ADMIN]: c({
        canAccessAdminPanel: true,
        canManagePurchases: true,
        canManageProducts: true,
        canManageUsers: true,
        canManageSettings: true,
        canViewPayments: true,
        canExportData: true,
        canShop: true,
    }),
    [USER_ROLES.CLIENT]: c({
        canShop: true,
    }),
};

export function buildRbac(role: UserRole | string): RbacConfig {
    return RBAC[role as UserRole] ?? RBAC[USER_ROLES.CLIENT];
}
