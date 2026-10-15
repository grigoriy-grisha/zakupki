import type { ProductCharacteristicValueSource } from '@/lib/product-label';

const WEIGHT_CHARACTERISTIC_NAME = 'вес';
const NUMBER_WITH_UNIT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:гр|г)/i;
const FIRST_NUMBER_PATTERN = /\d+(?:[.,]\d+)?/;

function firstNumberToken(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const match = raw.match(FIRST_NUMBER_PATTERN);
    return match ? match[0] : null;
}

function htmlToText(html: string): string {
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

export function tubeFacingLabel(source: {
    characteristicValues?: ProductCharacteristicValueSource[];
    description?: string | null;
}): string {
    const weightValue = (source.characteristicValues ?? []).find(
        (cv) => (cv.characteristic?.name ?? '').trim().toLowerCase() === WEIGHT_CHARACTERISTIC_NAME,
    );
    const fromCharacteristic = firstNumberToken(weightValue?.value);
    if (fromCharacteristic) {
        return `туба ${fromCharacteristic} гр`;
    }

    const fromDescription = htmlToText(source.description ?? '').match(NUMBER_WITH_UNIT_PATTERN);
    if (fromDescription) {
        return `туба ${fromDescription[1]} гр`;
    }
    return 'туба';
}
