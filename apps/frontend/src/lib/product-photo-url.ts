/** URL фото товара; `version` сбрасывает кэш браузера после новой загрузки. */
export function productPhotoUrl(id: number, version?: number | string): string {
    const base = `/api/photos/${id}`;
    if (version == null) return base;
    return `${base}?v=${encodeURIComponent(String(version))}`;
}

/** Абсолютный URL — для Telegram WebView и `<img>` без сюрпризов с base path. */
export function absoluteProductPhotoUrl(id: number, version?: number | string): string {
    const path = productPhotoUrl(id, version);
    if (typeof window === 'undefined') return path;
    return new URL(path, window.location.origin).href;
}
