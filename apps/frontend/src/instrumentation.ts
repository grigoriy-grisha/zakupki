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

        // Сверка онлайн-платежей, по которым не пришёл вебхук (истёкшие ссылки, сбои доставки).
        const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
        const globalForSweep = globalThis as unknown as { __onlinePaymentSweep?: NodeJS.Timeout };
        if (!globalForSweep.__onlinePaymentSweep) {
            globalForSweep.__onlinePaymentSweep = setInterval(() => {
                void (async () => {
                    try {
                        const { serviceContainer } = await import('@/server/lib/service-container');
                        await serviceContainer.onlinePayment.sweepStale();
                    } catch (err) {
                        console.warn('[instrumentation] online payment sweep failed:', err);
                    }
                })();
            }, SWEEP_INTERVAL_MS);
            globalForSweep.__onlinePaymentSweep.unref?.();
        }
    }
}
