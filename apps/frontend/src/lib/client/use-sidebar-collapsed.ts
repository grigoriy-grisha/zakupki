'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'zakupki-sidebar-collapsed';
const MOBILE_BREAKPOINT = 768;

export function useSidebarCollapsed() {
    const [collapsed, setCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'true') setCollapsed(true);
    }, []);

    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= MOBILE_BREAKPOINT) setMobileOpen(false);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const toggle = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(STORAGE_KEY, String(next));
            } catch {
                /* ignore */
            }
            return next;
        });
    }, []);

    const toggleMobile = useCallback(() => setMobileOpen((prev) => !prev), []);
    const closeMobile = useCallback(() => setMobileOpen(false), []);

    return {
        collapsed: mounted ? collapsed : false,
        toggle,
        mobileOpen,
        toggleMobile,
        closeMobile,
    };
}
