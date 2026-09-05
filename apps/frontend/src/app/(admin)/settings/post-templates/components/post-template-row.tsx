'use client';

import { AlertCircle, ChevronRight, Loader2, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { postTemplateEngine } from '@/lib/product-description';

import { useUpdatePostTemplate } from '../hooks';
import { PostTemplateEditor } from './post-template-editor';
import { PostTemplatePreview } from './post-template-preview';

export function PostTemplateRow({
    template,
    expanded,
    onToggle,
    onDelete,
}: {
    template: { id: number; name: string; body: string };
    expanded: boolean;
    onToggle: () => void;
    onDelete: () => void;
}) {
    const update = useUpdatePostTemplate();
    const [name, setName] = useState(template.name);
    const [body, setBody] = useState(template.body);

    useEffect(() => {
        setName(template.name);
        setBody(template.body);
    }, [template.id]);

    const trimmedName = name.trim();
    const isDirty = trimmedName !== template.name || body !== template.body;
    const canSave = trimmedName.length > 0 && isDirty;

    const unknownPlaceholders = useMemo(() => postTemplateEngine.findUnknownPlaceholders(body), [body]);

    function handleSave() {
        if (!canSave) return;
        update.mutate(
            { id: template.id, name: trimmedName, body },
            {
                onSuccess: (saved: { name: string; body: string }) => {
                    setName(saved.name);
                    setBody(saved.body);
                },
            },
        );
    }

    return (
        <div className="rounded-lg bg-bg-soft">
            <div className="flex items-center gap-1 p-2">
                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onToggle}>
                    <ChevronRight className={`size-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </Button>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                    }}
                    className="h-8 flex-1 border-transparent bg-transparent text-14-medium shadow-none hover:border-border focus-visible:border-border"
                />
                {isDirty && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-secondary"
                        title="Сохранить"
                        aria-label="Сохранить"
                        disabled={!canSave || update.isPending}
                        onClick={handleSave}
                    >
                        {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="size-8 text-error hover:text-error" onClick={onDelete}>
                    <Trash2 className="size-4" />
                </Button>
            </div>
            {expanded && (
                <div className="space-y-3 border-t px-3 pb-3 pt-2">
                    <div className="grid gap-3 lg:grid-cols-2">
                        <PostTemplateEditor
                            key={template.id}
                            initialHtml={body}
                            onChange={setBody}
                        />
                        <PostTemplatePreview body={body} />
                    </div>
                    {unknownPlaceholders.length > 0 && (
                        <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-2 text-12-regular text-warning">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                                Неизвестные метки: {unknownPlaceholders.map((k) => `{{${k}}}`).join(', ')}. Они попадут
                                в пост как обычный текст. Доступные метки — под чевроном редактора.
                            </span>
                        </div>
                    )}
                    <Button className="w-full sm:w-auto" disabled={!canSave || update.isPending} onClick={handleSave}>
                        {update.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                        Сохранить шаблон
                    </Button>
                </div>
            )}
        </div>
    );
}
