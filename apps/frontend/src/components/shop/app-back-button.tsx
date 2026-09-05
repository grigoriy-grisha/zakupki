'use client';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useSmartBack } from '@/lib/hooks/use-app-back';

interface AppBackButtonProps {
    fallbackHref: string;
    label: string;
}

export function AppBackButton({ fallbackHref, label }: AppBackButtonProps) {
    const onBack = useSmartBack(fallbackHref);

    return (
        <Button variant="ghost" size="sm" className="-ml-2 self-start text-fg-secondary" onClick={onBack}>
            <ArrowLeft className="size-4" />
            {label}
        </Button>
    );
}
