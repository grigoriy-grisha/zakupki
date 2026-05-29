'use client';

import { POST_TEMPLATE_PLACEHOLDERS } from '@/app/(admin)/products/lib';

export function PostTemplatePlaceholdersHint() {
    return (
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <ul className="space-y-2">
                {POST_TEMPLATE_PLACEHOLDERS.map((p) => (
                    <li key={p.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <button
                            type="button"
                            className="shrink-0 rounded-md border bg-background px-2 py-0.5 font-mono text-xs text-foreground hover:bg-accent"
                            title={p.label}
                            onClick={() => void navigator.clipboard.writeText(`{{${p.key}}}`)}
                        >
                            {`{{${p.key}}}`}
                        </button>
                        <span className="text-muted-foreground">{p.description}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
