import { describe, expect, it } from 'vitest';

import { BotConfig } from '../../config/bot-config';
import { buildOpenPurchaseKeyboard } from '../dm-keyboard';

function cfgFromEnv(env: Record<string, string>): BotConfig {
    return new BotConfig(env as NodeJS.ProcessEnv);
}

describe('buildOpenPurchaseKeyboard', () => {
    it('builds a startapp deep link for t.me mini apps (purchase level)', () => {
        const cfg = cfgFromEnv({ TELEGRAM_MINI_APP_URL: 'https://t.me/bot_liqudation_bot/biser_app' });

        const keyboard = buildOpenPurchaseKeyboard({ purchaseId: 4 }, cfg);

        expect(keyboard).toEqual({
            inline_keyboard: [
                [{ text: 'Открыть закупку', url: 'https://t.me/bot_liqudation_bot/biser_app?startapp=p4' }],
            ],
        });
        expect(JSON.stringify(keyboard)).not.toContain('web_app');
    });

    it('targets the item inside the mini app when the payload carries purchaseItemId', () => {
        const cfg = cfgFromEnv({ TELEGRAM_MINI_APP_URL: 'https://t.me/bot_liqudation_bot/biser_app' });

        const keyboard = buildOpenPurchaseKeyboard({ purchaseId: 4, purchaseItemId: 123 }, cfg);

        expect(keyboard).toEqual({
            inline_keyboard: [
                [{ text: 'Открыть закупку', url: 'https://t.me/bot_liqudation_bot/biser_app?startapp=p4i123' }],
            ],
        });
    });

    it('uses a web_app button with the purchase deep link for registered https domains', () => {
        const cfg = cfgFromEnv({ WEBAPP_URL: 'https://zakupki.example.com' });

        const keyboard = buildOpenPurchaseKeyboard({ purchaseId: 7 }, cfg);

        expect(keyboard).toEqual({
            inline_keyboard: [
                [{ text: 'Открыть закупку', web_app: { url: 'https://zakupki.example.com/tg/shop/purchase/7' } }],
            ],
        });
    });

    it('appends the item path for https domains when purchaseItemId is present', () => {
        const cfg = cfgFromEnv({ WEBAPP_URL: 'https://zakupki.example.com' });

        const keyboard = buildOpenPurchaseKeyboard({ purchaseId: 7, purchaseItemId: 123 }, cfg);

        expect(keyboard).toEqual({
            inline_keyboard: [
                [
                    {
                        text: 'Открыть закупку',
                        web_app: { url: 'https://zakupki.example.com/tg/shop/purchase/7/item/123' },
                    },
                ],
            ],
        });
    });

    it('prefers the mini app url over the plain webapp url', () => {
        const cfg = cfgFromEnv({
            WEBAPP_URL: 'https://zakupki.example.com',
            TELEGRAM_MINI_APP_URL: 'https://mini.example.com',
        });

        const keyboard = buildOpenPurchaseKeyboard({ purchaseId: 7 }, cfg);

        expect(keyboard).toEqual({
            inline_keyboard: [
                [
                    {
                        text: 'Открыть закупку',
                        web_app: { url: 'https://mini.example.com/tg/shop/purchase/7' },
                    },
                ],
            ],
        });
    });

    it('returns null when no url is configured', () => {
        expect(buildOpenPurchaseKeyboard({ purchaseId: 1 }, cfgFromEnv({}))).toBeNull();
    });

    it('returns null for non-https urls', () => {
        const cfg = cfgFromEnv({ WEBAPP_URL: 'http://localhost:5001' });
        expect(buildOpenPurchaseKeyboard({ purchaseId: 1 }, cfg)).toBeNull();
    });

    it('returns null when the payload carries no usable purchaseId', () => {
        const cfg = cfgFromEnv({ WEBAPP_URL: 'https://zakupki.example.com' });
        expect(buildOpenPurchaseKeyboard(null, cfg)).toBeNull();
        expect(buildOpenPurchaseKeyboard({}, cfg)).toBeNull();
        expect(buildOpenPurchaseKeyboard({ purchaseId: '4' }, cfg)).toBeNull();
    });
});
