/**
 * In-app navigation history for the current browser tab.
 *
 * Mirrors the entries the app pushed itself (soft navigations inside shop)
 * so back buttons can choose between `router.back()` and a fallback href.
 * Stored in sessionStorage: survives reloads, isolated per tab.
 */

const STORAGE_KEY = 'zakupki:app-history';

/** A popstate younger than this is treated as a back/forward navigation. */
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
        // Storage unavailable (private mode, quota) — tracking degrades to "no in-app back"
    }
}

export function currentUrl(): string {
    if (typeof window === 'undefined') return '';
    return `${window.location.pathname}${window.location.search}`;
}

/**
 * Starts a fresh stack. Called when the shop shell mounts: after a direct
 * entry, reload or login redirect there is no in-app entry to return to,
 * so assuming "no back" is always safe.
 */
export function resetAppHistory(url: string) {
    writeStack([url]);
}

/**
 * Records a pathname change. Popstate changes unwind the stack to the
 * revisited entry; regular changes push a new one.
 */
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

/** Whether there is an in-app entry to go back to. */
export function hasInAppBack(): boolean {
    return readStack().length > 1;
}
