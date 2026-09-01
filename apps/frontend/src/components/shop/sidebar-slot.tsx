'use client';

import { createContext, type ReactNode, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

interface SidebarSlotStore {
    get: () => ReactNode;
    set: (node: ReactNode) => void;
    subscribe: (listener: () => void) => () => void;
}

const SidebarSlotContext = createContext<SidebarSlotStore | null>(null);

function createSlotStore(): SidebarSlotStore {
    let content: ReactNode = null;
    const listeners = new Set<() => void>();
    return {
        get: () => content,
        set: (node) => {
            content = node;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export function SidebarSlotProvider({ children }: { children: ReactNode }) {
    const store = useMemo(createSlotStore, []);

    return <SidebarSlotContext.Provider value={store}>{children}</SidebarSlotContext.Provider>;
}

export function useSidebarSlotContent(render: () => ReactNode) {
    const store = useContext(SidebarSlotContext);

    useEffect(() => {
        store?.set(render());
    });

    useEffect(() => {
        return () => store?.set(null);
    }, [store]);
}

export function SidebarSlot() {
    const store = useContext(SidebarSlotContext);
    const content = useSyncExternalStore(
        store?.subscribe ?? ((listener: () => void) => () => void listener),
        store?.get ?? (() => null),
        () => null,
    );

    return <>{content}</>;
}
