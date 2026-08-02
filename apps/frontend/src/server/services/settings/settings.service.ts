import {
    type SettingDef,
    type SettingKey,
    type SettingValue,
    getSettingDef,
    parseSettingValue,
    serializeSettingValue,
    SETTINGS_SCHEMA,
    ValidationError,
} from '@zakupki/types';

import { settingsCache } from './settings-cache';

/**
 * Типобезопасный generic-сервис настроек.
 *
 * Потребители вызывают `get<K>('bead_pack_price_discount_percent')` и получают
 * сразу `number` (а не строку), потому что парсинг идёт здесь по схеме.
 *
 * Поведение при ошибках:
 * - get: при сбое БД/парсера → логируем, отдаём default (не валим запрос).
 * - set: валидируем на запись; при сбое БД → ValidationError с подсказкой про миграции.
 */
export class SettingsService {
    async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
        let raw: string | undefined;
        try {
            await settingsCache.ensureLoaded();
            raw = settingsCache.get(key);
        } catch (error) {
            console.error(`[settings] get ${key} failed (cache):`, error);
            return getSettingDef(key).default as SettingValue<K>;
        }
        try {
            return parseSettingValue(key, raw ?? null);
        } catch (error) {
            console.error(`[settings] parse ${key} failed, using default:`, error);
            return getSettingDef(key).default as SettingValue<K>;
        }
    }

    async getMany<K extends readonly SettingKey[]>(keys: K): Promise<{ [I in K[number]]: SettingValue<I> }> {
        const out: Record<string, unknown> = {};
        for (const k of keys) {
            out[k] = await this.get(k);
        }
        return out as { [I in K[number]]: SettingValue<I> };
    }

    async getAll(): Promise<{ [K in SettingKey]: SettingValue<K> }> {
        const keys = Object.keys(SETTINGS_SCHEMA) as SettingKey[];
        return (await this.getMany(keys)) as { [K in SettingKey]: SettingValue<K> };
    }

    async set<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void> {
        validateOnWrite(key, value);
        const serialized = serializeSettingValue(key, value);
        try {
            await settingsCache.set(key, serialized);
        } catch (error) {
            console.error(`[settings] set ${key} failed:`, error);
            throw new ValidationError(
                'Не удалось сохранить настройку. Проверьте подключение к БД и примените миграции (prisma migrate deploy).',
            );
        }
    }
}

function validateOnWrite<K extends SettingKey>(key: K, value: SettingValue<K>): void {
    // Каст к union нужен, чтобы switch ниже видел все возможные `type`.
    const def: SettingDef = (SETTINGS_SCHEMA as Record<string, SettingDef>)[key];
    if (def.type === 'number') {
        const n = value as number;
        if (!Number.isFinite(n)) throw new ValidationError(`${key}: не число`);
        if (def.min != null && n < def.min) throw new ValidationError(`${key} меньше минимума (${def.min})`);
        if (def.max != null && n > def.max) throw new ValidationError(`${key} больше максимума (${def.max})`);
    }
    if (def.type === 'boolean' && typeof value !== 'boolean') {
        throw new ValidationError(`${key}: не boolean`);
    }
    if (def.type === 'string' && typeof value !== 'string') {
        throw new ValidationError(`${key}: не строка`);
    }
}
