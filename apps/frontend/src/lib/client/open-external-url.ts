/**
 * Открывает внешнюю ссылку (форма оплаты банка) так, чтобы она работала и в мини-приложениях.
 * Вызывать только из обработчика клика — иначе браузеры/Telegram блокируют открытие.
 */
export function openExternalUrl(url: string): void {
    const tg = window.Telegram?.WebApp;
    if (tg?.initData && tg.openLink) {
        tg.openLink(url);
        return;
    }
    const inIframe = window.self !== window.top;
    if (inIframe) {
        // VK mini-app и прочие iframe: форма банка не открывается во фрейме.
        // Без 'noopener' в features: с ним window.open всегда возвращает null,
        // и мы бы ещё и уводили сам фрейм на банк.
        const win = window.open(url, '_blank');
        if (win) {
            win.opener = null;
            return;
        }
    }
    window.location.assign(url);
}

/**
 * Можно ли открыть ссылку без клика: в обычной вкладке браузера переход через location
 * не блокируется. В Telegram и во фреймах (VK) нужен клик пользователя — там показываем кнопку.
 */
export function canRedirectWithoutGesture(): boolean {
    if (window.Telegram?.WebApp?.initData) return false;
    return window.self === window.top;
}
