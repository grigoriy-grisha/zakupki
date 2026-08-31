'use client';

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
        <div className="mb-2">
            <div className="mb-1 flex flex-wrap items-baseline gap-x-2">
                <span className="text-12-regular text-fg-tertiary">Шаблон поста</span>
                <span className="text-11-regular text-fg-tertiary opacity-70">
                    Выберите шаблон, чтобы автоматически заполнить описание
                </span>
            </div>
            <Select value={templateId} onValueChange={onChange}>
                <SelectTrigger className="h-8 rounded-xl text-13-medium">
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
        </div>
    );
}
