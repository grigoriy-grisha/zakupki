const STORAGE_KEY = 'zakupki:app-history';

const POP_FLAG_TTL_MS = 1000;

let lastPopAt = 0;

export function markPopNavigation() {
    lastPopAt = Date.now();
}

function isPopNavigation(): boolean {
    return Date.now() - lastPopAt < POP_FLAG_TTL_MS;
}

function readStack(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((entry): entry is string => typeof entry === 'string');
    } catch {
        return [];
    }
}

function writeStack(stack: string[]) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack));
    } catch {
        return;
    }
}

export function currentUrl(): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.pathname}${window.location.search}`;
}

export function resetAppHistory(url: string) {
    writeStack([url]);
}

export function recordAppNavigation(url: string) {
    const stack = readStack();
    if (isPopNavigation()) {
        lastPopAt = 0;
        const index = stack.lastIndexOf(url);
        if (index >= 0) {
            stack.length = index + 1;
        } else {
            stack.push(url);
        }
    } else {
        stack.push(url);
    }
    writeStack(stack);
}

export function hasInAppBack(): boolean {
    return readStack().length > 1;
}
