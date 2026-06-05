/** Общие CSS-классы для таблицы товаров в закупке */
export const purchaseItemTextClass = 'text-sm font-semibold text-foreground';
export const purchaseItemSubtitleClass = 'text-sm font-medium text-muted-foreground';
export const purchaseItemNumericClass = `${purchaseItemTextClass} tabular-nums whitespace-nowrap`;
export const purchaseItemHeadClass =
    'text-sm font-medium text-muted-foreground whitespace-normal text-center leading-snug align-middle px-2';
export const purchaseItemTgColumnClass =
    'w-14 pr-5 align-middle [&:has([role=checkbox])]:pr-5 [&_[role=checkbox]]:translate-y-0';
export const purchaseItemTgHeadClass = `${purchaseItemHeadClass} ${purchaseItemTgColumnClass}`;
export const purchaseItemStatsLeadHeadClass = `${purchaseItemHeadClass} pl-4`;
export const purchaseItemTgCellClass = `${purchaseItemTgColumnClass} text-center`;
export const purchaseItemStatsLeadCellClass = `${purchaseItemNumericClass} pl-4`;
