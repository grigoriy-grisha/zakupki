import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    descriptionMobile?: string;
    iconClassName?: string;
    children?: React.ReactNode;
}

export function PageHeader({ icon: Icon, title, description, descriptionMobile, iconClassName, children }: PageHeaderProps) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClassName ?? 'bg-primary/10'}`}>
                <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {descriptionMobile ? (
                            <>
                                <span className="hidden sm:inline">{description}</span>
                                <span className="sm:hidden">{descriptionMobile}</span>
                            </>
                        ) : (
                            description
                        )}
                    </p>
                )}
            </div>
            {children}
        </div>
    );
}
