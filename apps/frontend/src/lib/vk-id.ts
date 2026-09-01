import * as VKID from '@vkid/sdk';

export function isVkConfigured() {
    const rawAppId = process.env.NEXT_PUBLIC_VK_APP_ID?.trim();
    return !!rawAppId && /^\d+$/.test(rawAppId);
}

export function initVkId() {
    if (!isVkConfigured()) {
        throw new Error(
            `NEXT_PUBLIC_VK_APP_ID is missing or invalid: expected a numeric app id from VK ID cabinet, got "${process.env.NEXT_PUBLIC_VK_APP_ID?.trim() ?? ''}"`,
        );
    }
    VKID.Config.init({
        app: Number(process.env.NEXT_PUBLIC_VK_APP_ID?.trim()),
        redirectUrl: process.env.NEXT_PUBLIC_VK_REDIRECT_URL || window.location.origin,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: '',
    });
}

export async function exchangeVkCode(payload: unknown) {
    const { code, device_id } = payload as { code: string; device_id: string };
    const vkData = await VKID.Auth.exchangeCode(code, device_id);
    return vkData.access_token;
}
