import type { Metadata } from 'next';

import { LegalDocument } from '../components/legal-document';
import { PRIVACY_INTRO, PRIVACY_META, PRIVACY_SECTIONS } from './content';

export const metadata: Metadata = {
    title: 'Согласие на обработку персональных данных',
    description:
        'Согласие пользователя сайта scheglove.ru на обработку персональных данных: перечень данных, цели, порядок отзыва.',
};

export default function PrivacyPage() {
    return <LegalDocument meta={PRIVACY_META} intro={PRIVACY_INTRO} sections={PRIVACY_SECTIONS} />;
}
