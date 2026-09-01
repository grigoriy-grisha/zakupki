'use client';

import { CheckCircle2Icon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="light"
            className="toaster group"
            icons={{
                success: <CheckCircle2Icon className="size-4" />,
                info: <InfoIcon className="size-4" />,
                warning: <TriangleAlertIcon className="size-4" />,
                error: <OctagonXIcon className="size-4" />,
                loading: <Loader2Icon className="size-4 animate-spin" />,
            }}
            toastOptions={{
                classNames: {
                    toast:
                        'group toast group-[.toaster]:bg-bg-card group-[.toaster]:text-fg-primary group-[.toaster]:border-border group-[.toaster]:border group-[.toaster]:shadow-md group-[.toaster]:rounded-xl group-[.toaster]:text-14-regular',
                    description: 'group-[.toast]:text-fg-secondary group-[.toast]:text-14-regular',
                    actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                    cancelButton: 'group-[.toast]:bg-bg-soft group-[.toast]:text-fg-secondary',
                },
            }}
            style={
                {
                    '--normal-bg': 'var(--bg-card)',
                    '--normal-text': 'var(--fg-primary)',
                    '--normal-border': 'var(--border)',
                    '--border-radius': '0.75rem',
                } as React.CSSProperties
            }
            {...props}
        />
    );
};

export { Toaster };
