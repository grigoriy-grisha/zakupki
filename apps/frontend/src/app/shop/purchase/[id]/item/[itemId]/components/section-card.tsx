import type { ReactNode } from 'react';

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-bg-card">
            <h2 className="border-b border-border-soft px-4 py-3 text-14-semibold text-fg-primary sm:px-5">{title}</h2>
            {children}
        </section>
    );
}
