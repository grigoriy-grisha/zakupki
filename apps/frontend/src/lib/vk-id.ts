import * as VKID from '@vkid/sdk';

export function initVkId() {
    const rawAppId = process.env.NEXT_PUBLIC_VK_APP_ID?.trim();
    if (!rawAppId || !/^\d+$/.test(rawAppId)) {
        throw new Error(
            `NEXT_PUBLIC_VK_APP_ID is missing or invalid: expected a numeric app id from VK ID cabinet, got "${rawAppId ?? ''}"`,
        );
    }
    VKID.Config.init({
        app: Number(rawAppId),
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
