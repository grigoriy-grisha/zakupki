'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NovelEditor } from '@/components/ui/novel-editor';
import { AlertCircle, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { postTemplateEngine } from '@/lib/product-description';
import { useUpdatePostTemplate } from '../hooks';
import { PostTemplatePreview } from './post-template-preview';

export function PostTemplateRow({
    template,
    onDelete,
}: {
    template: { id: number; name: string; body: string };
    onDelete: () => void;
}) {
    const update = useUpdatePostTemplate();
    const [expanded, setExpanded] = useState(false);
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
                onSuccess: (saved) => {
                    setName(saved.name);
                    setBody(saved.body);
                },
            },
        );
    }

    return (
        <div className="rounded-lg border">
            <div className="flex items-center gap-1 p-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setExpanded((v) => !v)}>
                    <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </Button>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 flex-1 border-transparent bg-transparent font-medium shadow-none hover:border-input focus-visible:border-input"
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={onDelete}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
            {expanded && (
                <div className="space-y-3 border-t px-3 pb-3 pt-2">
                    <div className="grid gap-3 lg:grid-cols-2">
                        <NovelEditor
                            key={template.id}
                            value={body}
                            onChange={setBody}
                            placeholder="Текст шаблона поста…"
                        />
                        <PostTemplatePreview body={body} />
                    </div>
                    {unknownPlaceholders.length > 0 && (
                        <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-400">
                            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                                Неизвестные метки: {unknownPlaceholders.map((k) => `{{${k}}}`).join(', ')}. Они попадут в
                                пост как обычный текст. Доступные метки — см. подсказку выше.
                            </span>
                        </div>
                    )}
                    <Button className="w-full sm:w-auto" disabled={!canSave || update.isPending} onClick={handleSave}>
                        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Сохранить шаблон
                    </Button>
                </div>
            )}
        </div>
    );
}
