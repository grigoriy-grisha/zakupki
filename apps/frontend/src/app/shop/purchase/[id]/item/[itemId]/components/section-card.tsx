import type { ReactNode } from 'react';

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="overflow-hidden rounded-2xl bg-bg-soft">
            <h2 className="border-b border-border-low px-4 py-3 font-display text-16-bold text-fg-primary sm:px-5">
                {title}
            </h2>
            {children}
        </section>
    );
}
