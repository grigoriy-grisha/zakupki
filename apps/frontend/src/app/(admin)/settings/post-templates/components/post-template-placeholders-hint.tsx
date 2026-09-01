'use client';

import { POST_TEMPLATE_PLACEHOLDERS } from '@/lib/product-description';

export function PostTemplatePlaceholdersHint() {
    return (
        <div className="rounded-lg border border-border-low bg-bg-card p-3">
            <div className="flex flex-wrap gap-2">
                {POST_TEMPLATE_PLACEHOLDERS.map((p) => (
                    <button
                        key={p.key}
                        type="button"
                        className="rounded-full border border-border bg-bg-soft px-2 py-0.5 font-mono text-12-regular text-fg-primary hover:bg-bg-soft/70"
                        onClick={() => void navigator.clipboard.writeText(`{{${p.key}}}`)}
                    >
                        {`{{${p.key}}}`}
                    </button>
                ))}
            </div>
        </div>
    );
}
