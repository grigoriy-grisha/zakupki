import { SettingsRepository, type RawSetting } from '../../domain/settings/settings.repository';

/**
 * In-memory кеш настроек на время жизни процесса Next.js.
 *
 * Контракт:
 * - `ensureLoaded()` подтягивает ВСЕ строки один раз (cold start → БД → кеш).
 * - `get(key)` мгновенно отдаёт строку из памяти.
 * - `set(key, value)` пишет в БД и обновляет локальный кеш (точечная инвалидация).
 * - `refresh()` сбрасывает кеш и тянет всё заново (для миграций / ручных правок).
 *
 * Edge-cases:
 * - Параллельные вызовы `ensureLoaded()` сшиваются через `inflight`.
 * - Если в БД упало — ошибка пробрасывается, кеш остаётся пустым.
 *   SettingsService ловит её и отдаёт default.
 */
class SettingsCache {
    private cache = new Map<string, string>();
    private inflight: Promise<void> | null = null;
    private readonly repo = new SettingsRepository();

    isLoaded(): boolean {
        return this.cache.size > 0;
    }

    async ensureLoaded(): Promise<void> {
        if (this.cache.size > 0) return;
        if (this.inflight) return this.inflight;

        this.inflight = this.load().finally(() => {
            this.inflight = null;
        });
        return this.inflight;
    }

    private async load(): Promise<void> {
        const rows: RawSetting[] = await this.repo.getAll();
        this.cache = new Map(rows.map((r) => [r.key, r.value]));
    }

    get(key: string): string | undefined {
        return this.cache.get(key);
    }

    async set(key: string, value: string): Promise<void> {
        await this.repo.set(key, value);
        this.cache.set(key, value);
    }

    async refresh(): Promise<void> {
        this.cache.clear();
        await this.ensureLoaded();
    }
}

export const settingsCache = new SettingsCache();
