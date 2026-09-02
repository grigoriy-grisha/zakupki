import type { Metadata } from 'next';

import { LegalDocument } from '../components/legal-document';
import { OFFER_INTRO, OFFER_META, OFFER_SECTIONS } from './content';

export const metadata: Metadata = {
    title: 'Агентская оферта',
    description:
        'Публичная оферта о заключении агентского договора на организацию приобретения товаров через совместные закупки scheglove.ru.',
};

export default function OfferPage() {
    return <LegalDocument meta={OFFER_META} intro={OFFER_INTRO} sections={OFFER_SECTIONS} />;
}
