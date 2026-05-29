'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NovelEditor } from '@/components/ui/novel-editor';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useUpdatePostTemplate } from '../hooks';

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
    }, [template.id, template.name, template.body]);

    function commitName() {
        const trimmed = name.trim();
        if (trimmed && trimmed !== template.name) {
            update.mutate({ id: template.id, name: trimmed });
        } else {
            setName(template.name);
        }
    }

    function saveBody(html: string) {
        setBody(html);
        if (html !== template.body) {
            update.mutate({ id: template.id, body: html });
        }
    }

    return (
        <div className="rounded-lg border">
            <div className="flex items-center gap-1 p-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setExpanded((v) => !v)}
                >
                    <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </Button>
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
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
                <div className="border-t px-3 pb-3 pt-2">
                    <NovelEditor value={body} onChange={saveBody} placeholder="Текст шаблона поста…" />
                </div>
            )}
        </div>
    );
}
