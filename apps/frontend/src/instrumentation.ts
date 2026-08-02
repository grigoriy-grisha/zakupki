export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Бот стартует асинхронно в фоне — `bot.start()` уходит в long-polling
        // и блокирует event loop, из-за чего первый HTTP-запрос зависает.
        // Запускаем без await и сразу возвращаемся: HTTP-сервер начнёт
        // обслуживать страницу, а бот подтянется в фоне.
        void (async () => {
            try {
                const { startBot } = await import('@/server/bot/start');
                await startBot();
            } catch (err) {
                console.warn('[instrumentation] bot startup failed:', err);
            }
        })();

        // Прогреваем in-memory кеш настроек, чтобы первый запрос
        // не упёрся в холодный старт и не получил default-ы.
        try {
            const { settingsCache } = await import('@/server/services/settings/settings-cache');
            await settingsCache.ensureLoaded();
        } catch (err) {
            console.warn('[instrumentation] settings cache warmup failed:', err);
        }
    }
}
