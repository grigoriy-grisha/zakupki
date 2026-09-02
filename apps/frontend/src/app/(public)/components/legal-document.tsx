import type { LegalSection } from '../offer/content';

interface LegalDocumentProps {
    meta: {
        title: string;
        subtitle: string;
        revision: string;
        operator: string;
        inn: string;
        ogrnip: string;
    };
    intro: string[];
    sections: LegalSection[];
}

export function LegalDocument({ meta, intro, sections }: LegalDocumentProps) {
    return (
        <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
            <p className="text-13-medium uppercase tracking-wide text-fg-tertiary">{meta.revision}</p>
            <h1 className="mt-2 font-display text-h1 text-secondary">{meta.title}</h1>
            <p className="mt-2 text-16-regular text-fg-secondary">{meta.subtitle}</p>

            <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-bg-soft px-3 py-1.5 text-13-medium text-fg-secondary">
                    {meta.operator}
                </span>
                <span className="rounded-full bg-bg-soft px-3 py-1.5 text-13-medium tabular-nums text-fg-secondary">
                    ИНН {meta.inn}
                </span>
                <span className="rounded-full bg-bg-soft px-3 py-1.5 text-13-medium tabular-nums text-fg-secondary">
                    ОГРНИП {meta.ogrnip}
                </span>
            </div>

            <div className="mt-8 space-y-3 rounded-2xl bg-bg-soft p-5 text-14-regular leading-relaxed text-fg-secondary">
                {intro.map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
            </div>

            <nav className="mt-10">
                <p className="text-13-medium uppercase tracking-wide text-fg-tertiary">Содержание</p>
                <ol className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                    {sections.map((section) => (
                        <li key={section.id}>
                            <a
                                href={`#${section.id}`}
                                className="text-14-medium text-secondary transition-colors hover:text-primary hover:underline"
                            >
                                {section.title}
                            </a>
                        </li>
                    ))}
                </ol>
            </nav>

            <div className="mt-12 space-y-10">
                {sections.map((section) => (
                    <section key={section.id} id={section.id} className="scroll-mt-20 border-t border-border-low pt-6">
                        <h2 className="font-display text-h3 text-fg-primary">{section.title}</h2>
                        {section.paragraphs?.map((paragraph) => (
                            <p
                                key={paragraph.slice(0, 40)}
                                className="mt-3 text-16-regular leading-relaxed text-fg-secondary"
                            >
                                {paragraph}
                            </p>
                        ))}
                        {section.bullets && (
                            <ul className="mt-3 space-y-2">
                                {section.bullets.map((bullet) => (
                                    <li
                                        key={bullet.slice(0, 40)}
                                        className="flex gap-2.5 text-16-regular leading-relaxed text-fg-secondary"
                                    >
                                        <span className="mt-[0.65em] size-1 shrink-0 rounded-full bg-fg-tertiary" />
                                        <span>{bullet}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}
