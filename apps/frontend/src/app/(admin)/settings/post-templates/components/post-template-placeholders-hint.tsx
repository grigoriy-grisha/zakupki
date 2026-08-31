'use client';

import { POST_TEMPLATE_PLACEHOLDERS } from '@/lib/product-description';

export function PostTemplatePlaceholdersHint() {
    return (
        <div className="rounded-md border bg-muted/40 p-3">
            <div className="flex flex-wrap gap-2">
                {POST_TEMPLATE_PLACEHOLDERS.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        className="rounded-md border bg-background px-2 py-0.5 font-mono text-xs text-foreground hover:bg-accent"
                        onClick={() => void navigator.clipboard.writeText(`{{${p.key}}}`)}
                    >
                        {`{{${p.key}}}`}
                    </button>
                ))}
            </div>
        </div>
    );
}
