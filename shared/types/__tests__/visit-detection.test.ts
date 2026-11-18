import { describe, expect, it } from 'vitest';

import { detectVisitDevice, detectVisitPlatform } from '../src';

describe('detectVisitDevice', () => {
    it('распознаёт телефон, планшет и компьютер', () => {
        expect(
            detectVisitDevice(
                'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Telegram-iOS',
            ),
        ).toBe('MOBILE');
        expect(
            detectVisitDevice(
                'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36',
            ),
        ).toBe('MOBILE');
        expect(detectVisitDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('TABLET');
        expect(
            detectVisitDevice('Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'),
        ).toBe('TABLET');
        expect(
            detectVisitDevice(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
            ),
        ).toBe('DESKTOP');
        expect(detectVisitDevice(null)).toBe('DESKTOP');
    });
});

describe('detectVisitPlatform', () => {
    it('берёт площадку из префикса пути и initData', () => {
        expect(detectVisitPlatform('/shop', true)).toBe('TELEGRAM');
        expect(detectVisitPlatform('/tg/shop/orders', false)).toBe('TELEGRAM');
        expect(detectVisitPlatform('/vk/shop', false)).toBe('VK');
        expect(detectVisitPlatform('/shop', false)).toBe('WEB');
        expect(detectVisitPlatform(null, false)).toBe('WEB');
    });
});
