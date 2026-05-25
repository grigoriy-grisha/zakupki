import * as VKID from '@vkid/sdk';

export function initVkId() {
    VKID.Config.init({
        app: Number(process.env.NEXT_PUBLIC_VK_APP_ID),
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
