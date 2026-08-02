'use client';

import { useEffect, useState } from 'react';
import { Bird } from 'lucide-react';

import { toDisplayAvatarUrl } from '@/lib/user-avatar-url';
import { cn } from '@/lib/utils';

type UserAvatarProps = {
    src?: string | null;
    className?: string;
    iconClassName?: string;
};

type LoadState = 'empty' | 'loading' | 'ready' | 'error';

function AvatarPlaceholder({ iconClassName }: { iconClassName?: string }) {
    return (
        <div
            className="flex size-full items-center justify-center rounded-full bg-bg-soft"
            aria-hidden
        >
            <Bird
                className={cn('h-8 w-8 shrink-0 text-fg-tertiary', iconClassName)}
                strokeWidth={1.75}
            />
        </div>
    );
}

function isLoadedImageUsable(img: HTMLImageElement): boolean {
    return img.naturalWidth >= 16 && img.naturalHeight >= 16;
}

/** Аватар: птичка, если нет URL, ошибка загрузки или «пустая» картинка. */
export function UserAvatar({ src, className, iconClassName }: UserAvatarProps) {
    const trimmed = src?.trim() ?? '';
    const displaySrc = toDisplayAvatarUrl(trimmed);
    const [state, setState] = useState<LoadState>(displaySrc ? 'loading' : 'empty');

    useEffect(() => {
        setState(displaySrc ? 'loading' : 'empty');
    }, [displaySrc]);

    const showPlaceholder = state === 'empty' || state === 'loading' || state === 'error';

    return (
        <div className={cn('relative shrink-0 overflow-hidden rounded-full', className)}>
            {showPlaceholder && <AvatarPlaceholder iconClassName={iconClassName} />}
            {displaySrc && state !== 'empty' && (
                <img
                    src={displaySrc}
                    alt=""
                    className={cn(
                        'absolute inset-0 size-full object-cover',
                        state !== 'ready' && 'opacity-0 pointer-events-none',
                    )}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    onLoad={(e) => {
                        setState(isLoadedImageUsable(e.currentTarget) ? 'ready' : 'error');
                    }}
                    onError={() => setState('error')}
                />
            )}
        </div>
    );
}
