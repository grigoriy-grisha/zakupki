import { dbClient } from '@zakupki/database';

export type RawSetting = { key: string; value: string };

/**
 * Generic key/value-репозиторий поверх таблицы `AppSetting`.
 * Типизация ключей и значений намеренно отсутствует —
 * это делает `SettingsService` поверх схемы `SETTINGS_SCHEMA`.
 */
export class SettingsRepository {
    async getAll(): Promise<RawSetting[]> {
        return dbClient.appSetting.findMany();
    }

    async getMany(keys: string[]): Promise<Map<string, string>> {
        const rows = await dbClient.appSetting.findMany({
            where: { key: { in: keys } },
        });
        return new Map(rows.map((r) => [r.key, r.value]));
    }

    async get(key: string): Promise<string | null> {
        const row = await dbClient.appSetting.findUnique({ where: { key } });
        return row?.value ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        await dbClient.appSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }
}
