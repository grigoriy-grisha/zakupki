'use client';

import { FormSection } from '@/components/ui/form-section';
import { NovelEditor } from '@/components/ui/novel-editor';

interface DescriptionSectionProps {
    productId: number;
    description: string;
    descriptionRevision: number;
    templateId: string;
    onChange: (value: string) => void;
}

export function DescriptionSection({
    productId,
    description,
    descriptionRevision,
    templateId,
    onChange,
}: DescriptionSectionProps) {
    return (
        <FormSection
            title="Описание"
            description={
                templateId === 'none'
                    ? 'Текст для поста — можно заполнить вручную'
                    : 'Сгенерировано из шаблона — можно отредактировать'
            }
        >
            <div className="max-h-[40vh] overflow-y-auto rounded-2xl border border-border bg-bg-base p-2">
                <NovelEditor
                    key={`purchase-desc-${productId}-${descriptionRevision}`}
                    value={description}
                    onChange={onChange}
                    placeholder={
                        templateId === 'none'
                            ? 'Текст описания для поста…'
                            : 'Текст из шаблона — можно дописать своё…'
                    }
                />
            </div>
        </FormSection>
    );
}
