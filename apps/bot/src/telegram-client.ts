import { ProxyAgent } from 'undici';

import type { BotConfig } from 'grammy';

import type { CustomContext } from './types';

/** Client options for grammY when TELEGRAM_PROXY is set (VPN / local proxy). */
export function getTelegramClientConfig(): BotConfig<CustomContext>['client'] | undefined {
    const proxy = process.env.TELEGRAM_PROXY?.trim();
    if (!proxy) return undefined;

    return {
        baseFetchConfig: {
            dispatcher: new ProxyAgent(proxy),
        },
    };
}
