'use client';

import { FormSection } from '@/components/ui/form-section';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface TemplateSectionProps {
    templateId: string;
    postTemplates: { id: number; name: string }[] | undefined;
    onChange: (value: string) => void;
}

export function TemplateSection({ templateId, postTemplates, onChange }: TemplateSectionProps) {
    return (
        <FormSection
            title="Шаблон поста"
            description="Выберите шаблон, чтобы автоматически заполнить описание"
        >
            <Select value={templateId} onValueChange={onChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Без шаблона" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Без шаблона</SelectItem>
                    {(postTemplates ?? []).map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </FormSection>
    );
}
