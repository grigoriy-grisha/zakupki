// Замечание: при использовании `src/` Next.js 16 читает `src/instrumentation.ts`,
// а этот файл (в корне) не выполняется. Оставлен для обратной совместимости
// со старыми версиями и для единообразия с src/instrumentation.ts.

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Бот стартует асинхронно в фоне — `bot.start()` уходит в long-polling
        // и блокирует event loop, из-за чего первый HTTP-запрос зависает.
        // Запускаем без await и сразу возвращаемся.
        void (async () => {
            try {
                const { startBot } = await import('@/server/bot/start');
                await startBot();
            } catch (err) {
                console.warn('[instrumentation] bot startup failed:', err);
            }
        })();
    }
}
