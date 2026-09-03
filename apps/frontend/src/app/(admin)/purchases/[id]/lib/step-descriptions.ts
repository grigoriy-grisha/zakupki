import type { PurchaseFulfillmentStatus } from '@zakupki/types';
import type { LucideIcon } from 'lucide-react';
import {
    BoxIcon,
    CheckCircle2Icon,
    ClipboardListIcon,
    CreditCardIcon,
    PackageCheckIcon,
    PackageOpenIcon,
    ShoppingBagIcon,
    TruckIcon,
    WalletIcon,
} from 'lucide-react';

export type StepActionId = 'publish-tg' | 'remainder' | 'advance' | 'close';

interface StepDescription {
    title: string;
    description: string;
    icon: LucideIcon;
    /** Подсказка (например, сколько осталось) */
    hint?: string;
    actions: StepActionId[];
}

export const STEP_DESCRIPTIONS: Record<PurchaseFulfillmentStatus, StepDescription> = {
    COLLECTION: {
        title: 'Сбор заказов',
        description: 'Участники выбирают товары.',
        icon: ClipboardListIcon,
        actions: ['advance'],
    },
    REORDER: {
        title: 'Доборы',
        description: 'Участники дозаказывают остатки у поставщика. Контролируйте лимиты.',
        icon: BoxIcon,
        actions: ['remainder', 'advance'],
    },
    PAYMENT: {
        title: 'Оплата заказов',
        description: 'Участники присылают чеки. Подтверждайте вручную во вкладке «Участники».',
        icon: CreditCardIcon,
        actions: ['advance'],
    },
    SUPPLIER_ASSEMBLY: {
        title: 'Комплектация',
        description: 'Поставщик собирает заказ. Дождитесь подтверждения готовности.',
        icon: PackageOpenIcon,
        actions: ['advance'],
    },
    PREPARING_SHIPMENT_RF: {
        title: 'Отправка в РФ',
        description: 'Заказ отправлен со склада поставщика.',
        icon: TruckIcon,
        actions: ['advance'],
    },
    IN_TRANSIT_RF: {
        title: 'В пути из ЕС в РФ',
        description: 'Заказ едет из ЕС в Россию.',
        icon: TruckIcon,
        actions: ['advance'],
    },
    IN_TRANSIT_TO_ORGANIZER: {
        title: 'До организатора',
        description: 'Заказ в РФ, едет к организатору.',
        icon: TruckIcon,
        actions: ['advance'],
    },
    PACKAGING: {
        title: 'Фасовка и сбор заказов',
        description: 'Организатор фасует товары и комплектует индивидуальные заказы участников.',
        icon: PackageCheckIcon,
        actions: ['advance'],
    },
    READY_FOR_PICKUP: {
        title: 'К выдаче',
        description: 'Заказ готов, участники забирают.',
        icon: ShoppingBagIcon,
        hint: 'Можно закрывать закупку',
        actions: ['close'],
    },
};

export const COMPLETED_ICON = CheckCircle2Icon;
export const PAYMENT_TIP_ICON = WalletIcon;
