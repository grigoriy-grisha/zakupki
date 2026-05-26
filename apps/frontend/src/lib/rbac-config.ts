import { RoleKind } from '@zakupki/database';
import { z } from 'zod';

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

type RbacRoleMap = Record<RoleKind, RbacConfig>;

const c = (config: Partial<RbacConfig>) => rbacConfigSchema().parse(config);

export const RBAC: RbacRoleMap = {
    [RoleKind.ADMIN]: c({
        canAccessAdminPanel: true,
        canManagePurchases: true,
        canManageProducts: true,
        canManageUsers: true,
        canManageSettings: true,
        canViewPayments: true,
        canExportData: true,
        canShop: true,
    }),
    [RoleKind.CLIENT]: c({
        canShop: true,
    }),
};

export function buildRbac(role: RoleKind): RbacConfig {
    return RBAC[role] ?? RBAC[RoleKind.CLIENT];
}
