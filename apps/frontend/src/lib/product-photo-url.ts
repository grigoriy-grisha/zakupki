/** URL фото товара; `version` сбрасывает кэш браузера после новой загрузки. */
export function productPhotoUrl(id: number, version?: number | string): string {
    const base = `/api/photos/${id}`;
    if (version == null) return base;
    return `${base}?v=${encodeURIComponent(String(version))}`;
}
