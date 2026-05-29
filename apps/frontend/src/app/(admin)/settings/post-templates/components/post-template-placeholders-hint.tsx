'use client';

import { POST_TEMPLATE_PLACEHOLDERS } from '@/app/(admin)/products/lib';

export function PostTemplatePlaceholdersHint() {
    return (
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">Метки для подстановки (клик — копировать):</p>
            <ul className="flex flex-wrap gap-2">
                {POST_TEMPLATE_PLACEHOLDERS.map((p) => (
                    <li key={p.key}>
                        <button
                            type="button"
                            className="rounded-md border bg-background px-2 py-1 font-mono text-xs text-foreground hover:bg-accent"
                            title={p.label}
                            onClick={() => void navigator.clipboard.writeText(`{{${p.key}}}`)}
                        >
                            {`{{${p.key}}}`}
                        </button>
                    </li>
                ))}
            </ul>
            <p className="mt-2 text-muted-foreground/90">
                В текст шаблона вставляйте только такие метки. Подписи из этого списка копировать не нужно.
            </p>
        </div>
    );
}
