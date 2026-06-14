/**
 * Единая декларативная схема настроек приложения.
 *
 * Добавить новую настройку = одна запись в SETTINGS_SCHEMA
 * и (опционально) ключ в SETTING_KEYS.
 *
 * Тип значения, дефолт и валидаторы описываются данными, а не кодом —
 * SettingsService парсит/сериализует/валидирует по схеме.
 *
 * UI/бот/расчёты цены НЕ должны ходить в БД/AppSetting напрямую —
 * только через `SettingsService` (generic) или `PricingSettingsService` (доменный).
 */
import { ValidationError } from './errors';

export type SettingType = 'number' | 'string' | 'boolean' | 'json';

export type NumberSettingDef = {
    type: 'number';
    default: number;
    min?: number;
    max?: number;
    description: string;
};

export type StringSettingDef = {
    type: 'string';
    default: string;
    description: string;
};

export type BooleanSettingDef = {
    type: 'boolean';
    default: boolean;
    description: string;
};

export type JsonSettingDef = {
    type: 'json';
    default: unknown;
    description: string;
};

export type SettingDef = NumberSettingDef | StringSettingDef | BooleanSettingDef | JsonSettingDef;

/** Кортеж всех ключей настроек — единый источник истины. */
const SETTING_KEYS = ['bead_pack_price_discount_percent'] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/** Декларативная схема. При добавлении ключа — добавить и в SETTING_KEYS. */
export const SETTINGS_SCHEMA = {
    bead_pack_price_discount_percent: {
        type: 'number' as const,
        default: 3,
        min: 0,
        max: 100,
        description: 'Скидка от цены за пачку бисера, %',
    },
} satisfies Record<SettingKey, SettingDef>;

/** Тип значения настройки по её ключу (берётся из поля `default` схемы). */
export type SettingValue<K extends SettingKey = SettingKey> = (typeof SETTINGS_SCHEMA)[K] extends {
    default: infer D;
}
    ? D
    : never;

const SETTING_KEY_SET: ReadonlySet<SettingKey> = new Set<SettingKey>(SETTING_KEYS);

export function isSettingKey(value: string): value is SettingKey {
    return SETTING_KEY_SET.has(value as SettingKey);
}

export function getSettingDef<K extends SettingKey>(key: K): (typeof SETTINGS_SCHEMA)[K] {
    return SETTINGS_SCHEMA[key];
}

/**
 * Внутренний helper: возвращает определение как union-тип, чтобы `switch` видел
 * все возможные `type` и exhaustiveness check работал. Наружу не экспортируем —
 * публичный `getSettingDef` сохраняет узкий тип для type-aware потребителей.
 */
function getAnySettingDef(key: SettingKey): SettingDef {
    return SETTINGS_SCHEMA[key] as SettingDef;
}

/** Round-trip сериализация значения настройки в строку для хранения в БД. */
export function serializeSettingValue<K extends SettingKey>(key: K, value: SettingValue<K>): string {
    const def = getAnySettingDef(key);
    if (def.type === 'json') return JSON.stringify(value);
    return String(value);
}

/** Дефолтное значение, сериализованное в строку (используется сидером). */
export function serializeDefault<K extends SettingKey>(key: K): string {
    return serializeSettingValue(key, getSettingDef(key).default as SettingValue<K>);
}

/** Парсинг строкового значения из БД в типизированное. */
export function parseSettingValue<K extends SettingKey>(key: K, raw: string | null | undefined): SettingValue<K> {
    const def = getAnySettingDef(key);

    if (raw == null || raw === '') {
        return def.default as SettingValue<K>;
    }

    switch (def.type) {
        case 'number': {
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) {
                throw new ValidationError(`${key}: не число`);
            }
            if (def.min != null && parsed < def.min) {
                throw new ValidationError(`${key} меньше минимума (${def.min})`);
            }
            if (def.max != null && parsed > def.max) {
                throw new ValidationError(`${key} больше максимума (${def.max})`);
            }
            return parsed as SettingValue<K>;
        }
        case 'boolean': {
            if (raw === 'true') return true as SettingValue<K>;
            if (raw === 'false') return false as SettingValue<K>;
            throw new ValidationError(`${key}: не boolean (ожидается "true"/"false")`);
        }
        case 'string': {
            return raw as SettingValue<K>;
        }
        case 'json': {
            try {
                return JSON.parse(raw) as SettingValue<K>;
            } catch {
                throw new ValidationError(`${key}: невалидный JSON`);
            }
        }
        default: {
            // Exhaustiveness: при добавлении нового типа компилятор ткнёт сюда.
            const _exhaustive: never = def;
            throw new ValidationError(`${key}: неизвестный тип: ${String(_exhaustive)}`);
        }
    }
}

/**
 * Цена пачки со скидкой.
 * Зависит от значения настройки `bead_pack_price_discount_percent`,
 * потому вынесено рядом со схемой.
 */
export function computeDiscountedPackPrice(packPrice: number, discountPercent: number): number {
    const discounted = packPrice * (1 - discountPercent / 100);
    return Math.round(discounted * 100) / 100;
}
