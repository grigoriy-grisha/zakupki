'use client';

import { createContext, type ReactNode,useContext, useEffect, useState } from 'react';

interface SidebarSlotValue {
    node: ReactNode;
    setNode: (node: ReactNode) => void;
}

const SidebarSlotContext = createContext<SidebarSlotValue | null>(null);

export function SidebarSlotProvider({ children }: { children: ReactNode }) {
    const [node, setNode] = useState<ReactNode>(null);

    return <SidebarSlotContext.Provider value={{ node, setNode }}>{children}</SidebarSlotContext.Provider>;
}

export function useSidebarSlotContent(render: () => ReactNode, deps: unknown[]) {
    const { setNode } = useContext(SidebarSlotContext) ?? {};

    useEffect(() => {
        setNode?.(render());
        return () => setNode?.(null);
    }, [setNode, ...deps]);
}

export function SidebarSlot() {
    const { node } = useContext(SidebarSlotContext) ?? { node: null };

    return <>{node}</>;
}
