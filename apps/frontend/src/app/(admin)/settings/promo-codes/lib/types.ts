export type PromoWithDates = {
    isActive: boolean;
    expiresAt: string | null;
    maxUses: number | null;
    usedCount: number;
};

export type PromoStatus = {
    label: string;
    className: string;
};
